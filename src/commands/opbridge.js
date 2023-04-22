/*
Derived from https://github.com/ethereum-optimism/optimism-tutorial/tree/main/cross-dom-bridge-eth
*/
import { ethers } from 'ethers';

import { urlConnect } from './connect.js';

import { MessageStatus, CrossChainMessenger } from  "@eth-optimism/sdk";

const log = console.log;
const out = console.log;
const vout = () => {};

export async function opeth(program, options, eth, key) {

  log(`hello ... ${eth} > ${ethers.utils.parseEther(eth)}`);
  const units = ethers.utils.parseEther(eth);

  // The optimism examples use MNEMONIC keys, for dev wallets we just use explicit private keys.
  if (!key) {
    out(`A key must be provided as a positional parameter (it can be a file name)`);
    process.exit(1);
  }

  const l1Url = program.opts().l1Url;
  if (!l1Url) {
    out(`The --l1-url option must be provided`);
    process.exit(1);
  }
  const l2Url = program.opts().url;
  if (!l2Url) {
    out(`The --url option must be provided`);
    process.exit(1);
  }

  const l1Signer = urlConnect(l1Url, {key, polling:true});
  const l2Signer = urlConnect(l2Url, {key, polling:true});

  out(`Transfering ${eth} (${units}) for Address: ${l1Signer.address}, L1 ${options.chainidL1} -> L2 ${options.chainidL2}`);

  const crossChainMessenger = new CrossChainMessenger({
      l1ChainId: options.chainidL1,
      l2ChainId: options.chainidL2,
      l1SignerOrProvider: l1Signer,
      l2SignerOrProvider: l2Signer,
      bedrock: true
  });


  const reportBalances = async () => {
    const l1Balance = (await crossChainMessenger.l1Signer.getBalance()).toString().slice(0,-9)
    const l2Balance = (await crossChainMessenger.l2Signer.getBalance()).toString().slice(0,-9)

    out(`On L1:${l1Balance} Gwei    On L2:${l2Balance} Gwei`)
  }

  out("Deposit ETH")
  await reportBalances()
  const start = new Date()

  if (!options.commit) {
    console.log(`dry run, exiting`);
    process.exit(0);
  }

  // TODO: let the response hash be provided as an option so interupted transfers can be resumed
  const response = await crossChainMessenger.depositETH(units)
  out(`Transaction hash (on L1): ${response.hash}`)
  await response.wait()
  out("Waiting for status to change to RELAYED")
  out(`Time so far ${(new Date()-start)/1000} seconds`)
  await crossChainMessenger.waitForMessageStatus(
    response.hash, MessageStatus.RELAYED)

  await reportBalances()
  out(`depositETH took ${(new Date()-start)/1000} seconds\n\n`)
}