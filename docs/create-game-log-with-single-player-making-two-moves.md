# Context

Recipie to create a new game, join it and commit and confirm to moves. Used to generate mock data for some of the tests.

Create a user key

    tusk new-wallet robin

Create a guardian key

    tusk new-wallet guardian

Create the game by providing the guardian key

    arenactl -d ../chaintrap-contracts/.local/dev/wallet-deploy.key -k .local/dev/wallets/guardian.key newgame

Create a user key

    tusk new-wallet bob

Join it providing the new wallet

    arenactl \
      -d ../chaintrap-contracts/.local/dev/wallet-deploy.key \
      -k .local/dev/wallets/robin.key join

As the guardian, set the new players start location

Get the wallet for the player

    arenactl -d ../chaintrap-contracts/.local/dev/wallet-deploy.key listplayers
    <name> <address>

Set the start

    arenactl \
      -d ../chaintrap-contracts/.local/dev/wallet-deploy.key \
      -k .local/dev/wallets/guardian.key \
      -m ../chaintrap-frontend/src/assets/map02.json \
      setstart \
        <address> 2

As the guardian, start the game

    arenactl \
      -d ../chaintrap-contracts/.local/dev/wallet-deploy.key \
      -k .local/dev/wallets/guardian.key startgame

Commit the first move

    arenactl \
      -d ../chaintrap-contracts/.local/dev/wallet-deploy.key \
      -k .local/dev/wallets/robin.key \
      commitexituse

Allow all pending moves in one shot

    arenactl \
      -d ../chaintrap-contracts/.local/dev/wallet-deploy.key \
      -k .local/dev/wallets/guardian.key \
      -m ../chaintrap-frontend/src/assets/map02.json \
        allowexituse

Run it a second time with -c to commit the reported changes

Note that commands for a specific game will default to chooing the last
created. But that is currently racy if multiple people are using the chain
