import { ethers } from "ethers";
import { isUndefined } from "./idioms.js";

const log = console.log;

export function addressFromKey(key) {
  return new ethers.Wallet(key).address;
}

/**
 * Derive the address the externaly owned account last deployed a contract to.
 * Assuming that the last transaction for that address _was_ a contract
 * deployment.
 * @param {string} from account that deployed the contract
 * @param {number} nonce used for the deploy tx (which was the transaction count at the time of deploy)
 */
export async function deriveContractAddress(provider, from, nonce = undefined) {
  // Note: if the provider is a signer then getTransactionCount is specifically
  // bound to the signer's wallet and passing an additional address just breaks.
  provider = provider.provider ?? provider;
  if (isUndefined(nonce)) {
    try {
      // nonce - 1 is the nonce of the *last* transaction on the account. Note: we
      // make the assumption in this method that the EOA for contract deployment
      // is _only_ used for deployment.

      nonce = (await provider.getTransactionCount(from)) - 1;
      if (nonce < 0) {
        log(`contract not deployed, nonce is zero for ${from}`);
        return;
      }
    } catch (e) {
      log(`error getting nonce for ${from}: ${JSON.stringify(e)}`);
      return;
    }
  }

  for (let i = 0; i < nonce; i++) {
    const a = ethers.utils.getContractAddress({ from, nonce: i });
  }

  return ethers.utils.getContractAddress({ from, nonce });
}
