/** ProviderType is used to facilitate provider specific behaviours
 */
export class ProviderType {
  static NamedRPC = 'namedrpc'
  static APIProxyRPC = 'apiproxyrpc'
  static EthersRPC = 'ethersrpc'
  static Injected = 'injected'
  static Metamask = 'metamask'
  static Hardhat = 'hardhat'
}