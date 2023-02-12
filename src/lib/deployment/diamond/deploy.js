import { ethers } from "ethers";
import { Reporter } from "../../reporter.js";
import { FacetCutOpts } from "./facet.js";
import { FacetCutAction } from "./selectors.js";

const isError = (v) => v?.constructor?.name === "Error";

export class DeployResult {
  static fromErr(err, msg = undefined) {
    return new DeployResult({ status: 1, msg, err });
  }

  static fromSuccess(tx, receipt, msg) {
    return new DeployResult({ status: 0, tx, receipt, msg });
  }

  static fromStatus(status, msg) {
    return new DeployResult({ status, msg });
  }
  static fromFailed(msg) {
    return DeployResult.fromStatus(1, msg);
  }
  static fromFaiedReceipt(receipt, tx, msg) {
    return new DeployResult({ status: 1, receipt, tx, msg, err });
  }

  constructor({ status, tx, receipt, msg, err }) {
    this.status = status;
    this.tx = tx;
    this.receipt = receipt;
    this._err = err;
    this.msg = msg;
  }

  isErr() {
    return this.status || this.err?.constructor?.name === "Error";
  }
  errmsg() {return this.msg || `${this.err} ${this.status}`}
}

export class DiamondDeployer {
  constructor(reporter, signer, readers, options) {
    this.reset(reporter, signer, readers, options);
  }

  reset(reporter, signer, readers, options) {
    this.r = reporter ?? new Reporter(console.log, console.log);
    this.signer = signer ?? null;
    this.readers = readers;
    this.facetCuts = [];
    this.results = [];
    this.errors = [];

    this.options = options ?? {};
    this.options.diamondName = options.diamondName ?? "Diamond";
    this.options.diamondCutName = options.diamondCutName ?? "DiamondCut";
    this.options.diamondInitName = options.diamondInitName ?? "DiamondInit";

    this.diamond = options.diamond ?? null;
    this.diamondCut = null;
    this.diamondInit = null;
  }
  /**
   * returns true if we have captured everything needed to deploy or upgrade the diamond contract
   * @returns {boolean}
   */
  canDeploy() {
    return (
      this.diamond &&
      this.diamondCut &&
      this.diamondCut.iface &&
      this.diamondCut.address &&
      this.diamondInit &&
      this.diamondInit.iface &&
      this.diamondInit.address &&
      this.signer &&
      this.errors.length === 0
    );
  }

  async deploy() {
    if (!this.canDeploy())
      throw new Error(
        `unable to deploy, errors or missing a signer or missing contracts for essential EIP 2535 behaviour`
      );

    var co = this.diamond;

    this.diamond.address = await this.tryDeploy(
      co.iface,
      co.bytecode,
      co,
      await this.signer.getAddress(),
      this.diamondCut.address
    );
    if (isError(this.diamond.address))
      return DeployResult.fromErr(
        this.diamond.address,
        `failed to deploy diamond ${co.name} ${address}`
      );

    if (!this.diamondCut?.address)
      DeployResult.fromFailed(`DiamondCut facet not deployed, exiting`);
    if (!this.diamondInit?.address)
      return DeployResult.fromFailed(
        `Diamond initialiser contract ${this.options.diamondInitName} not deployed`
      );

    const args = JSON.parse(this.options.diamondInitArgs);
    const initCalldata = this.diamondInit.iface.encodeFunctionData(
      "init",
      args
    );

    const cutter = new ethers.Contract(
      this.diamond.address,
      this.diamondCut.iface,
      this.signer
    );
    const tx = await cutter.diamondCut(
      this.facetCuts,
      this.diamondInit.address,
      initCalldata
    );
    const receipt = await tx.wait();
    if (!receipt.status) return DeployResult.fromFaiedReceipt(receipt, tx, `Diamond upgrade failed: ${tx.hash}`);

    return DeployResult.fromSuccess(tx, receipt, `Diamond upgrade success: ${tx.hash}`);
  }

  reporterrs() {
    if (!this.errors?.length) return;

    for (const [co, err] of this.errors)
      this.r.out(
        `error creating deploy transaction for ${co.commonName} ${err}`
      );
  }
  report() {
    this.r.out(
      JSON.stringify(
        deployer.results.map((r) => r.data),
        null,
        2
      )
    );
  }

  /**
   * deploy each item in cuts that isn't a contract with specific deployment behaviour in EIP 2535
   * specifically handled are named by the options see {@link reset}
   * - diamond - the sources are read but the contract is not deployed
   * - diamondCut - the sources are read and the contract is deployed
   * - diamondInit - the sources are read and the contract is deployed
   * Each of these is remembered on an instance attribute of the same name
   * @param {*} cuts
   */
  async processCuts(cuts) {
    for (const co of cuts) {
      const reader = this.readers[co.readerName];
      if (!reader) {
        r.out(`reader ${co.readerName} not supported, skipping ${co.fileName}`);
        continue;
      }

      var address;
      const [iface, bytecode] = loadCutOptions(reader, co);
      co.iface = iface;
      co.bytecode = bytecode;

      // capture the Diamond, it deploys last and requires constructor arguments.
      if (co.name === this.options.diamondName) {
        // note: the diamond may be provided a-prior (and will be for upgrades)
        if (!this.diamond) this.diamond = co;
        continue;
      }

      // never delegated
      co.removeSignatures("init(bytes)");

      address = await this.tryDeploy(iface, bytecode, co);
      if (isError(address)) continue;
      co.address = address;
      co.iface = iface;

      if (co.name == this.options.diamondCutName) {
        this.diamondCut = co;
        // the diamondCut is added in the diamond constructor
        continue;
      }

      if (co.name == this.options.diamondInitName) {
        if (!this.diamondInit) this.diamondInit = co;
        // this isn't a facet
        continue;
      }

      if (!isError(address)) {
        this.facetCuts.push({
          facetAddress: address,
          action: FacetCutAction.Add,
          functionSelectors: co.selectors,
        });
      }
    }
  }

  /**
   * Attempt a deploy and return the result if successful. if an exception
   * occurs *catch* it and return it. errors are also accumulated internaly.
   *
   * If operating in offline mode (no signer provided) the returned result is an
   * unsigned transaction, otherwise it is the deployed address of the contract.
   *
   * @param {ethers.Interface} iface  {@link https://docs.ethers.org/v5/api/utils/abi/interface/#Interface}
   * @param {string} bytecode
   * @param {FacetCutOpts} co
   * @param  {...any} args
   * @returns {string|import('ethers').UnsignedTransaction|erorr} address, unsigned transaction or an error
   */
  async tryDeploy(iface, bytecode, co, ...args) {
    try {
      // facets are not allowed constructor arguments
      const [address, tx, msg] = await deployContract(
        iface,
        bytecode,
        this.signer,
        co,
        ...args
      );
      this.r.out(msg);
      this.results.push(tx ?? msg);
      return tx ?? address;
    } catch (err) {
      this.errors.push([co, err]);
      return err;
    }
  }
}

/**
 * use the reader instance to read the compiler output from the cut options co
 * @param {BaseReader} reader
 * @param {FacetCutOpts} co
 * @returns {[import('ethers').Interface, string, object]} - [abi contract interface, the bytecode and the compiler output]
 */
export function loadCutOptions(reader, co) {
  const solOutput = reader.readJson(co.fileName);
  const iface = new ethers.utils.Interface(solOutput.abi);
  return [iface, solOutput.bytecode, solOutput];
}

export async function deployContract(iface, bytecode, signer, co, ...args) {
  const factory = new ethers.ContractFactory(iface, bytecode, signer);

  if (signer) {
    const facet = await factory.deploy(...args);
    await facet.deployed();
    const msg = `deployed facet ${co.name}@${facet.address}`;
    return [facet.address, null, msg];
  } else {
    const tx = factory.getDeployTransaction();
    return [
      ethers.constants.AddressZero,
      tx,
      `deploy calldata for facet ${co.name}`,
    ];
  }
}
