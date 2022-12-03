const log = console.log;

export async function lastGame(program, options, address) {
  let vlog = () => {};
  if (program.opts().verbose) vlog = log;
  vlog(`hello: ${address}`);
}

export async function gameState(program, options, address, gid) {
  let vlog = () => {};
  if (program.opts().verbose) vlog = log;
  vlog(`hello: ${address} ${gid}`);
}
