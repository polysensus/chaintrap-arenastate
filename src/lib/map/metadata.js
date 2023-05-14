// metadata properties from map collection entries

/**
 * Create ERC 1155 style metadata properties for a map collection entry.
 * @param {*} map a single map collection entry
 */
export function mapMetadataProperties(map) {
  const properties = {};
  const public_proof = {
    beta: vrf_inputs.proof.beta,
    public_key: vrf_inputs.proof.public_key,
  };
}
