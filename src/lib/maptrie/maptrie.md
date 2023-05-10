# A review of chaintrap events, game states and player states

## game states

`game.started`, `game.completed`

## player states

`player.halted` (dead or victorious)

## game events

PlayerEnteredLocation
PlayerKilledByTrap
PlayerDied
PlayerGainedLife
PlayerLostLife
PlayerVictory
PlayerUsedFurniture

`UseExit`, `ExitUsed`
`EntryReject`
`UseToken`
`FurnitureUsed`

# A review of chaintrap map definitions

A `JOIN` is a pair of location indices and a pair of location sides:

    LOCATION_JOINS: [LOCATION-a, LOCATION-b]
    LOCATION_JOIN_SIDES: [SIDE-a, SIDE-b]

    JOIN: [LOCATION_JOIN_SIDES, LOCATION_JOINS, JOIN-FLAGS]

A `JOIN` is _either_ a `CORRIDOR` which has shape and length, or it is an `ABUTMENT` where the location is adjacent and the exit from one directly enters the other location.

If `JOIN-FLAGS & FLAG_CORRIDOR` then the JOIN is a corridor, otherwise the two locations are adjacent.

Eg ether

     _____    _____
    |     |  |     |
    |     +--+     |
    |     +--+     |
    |_____|  |_____|

Or

     _____  _____
    |     ||     |
    |     ++     |
    |     ++     |
    |_____||_____|

> Note: it is not clear whether it is better, in the abutment case, to deal with the door as seperate door-side objects. seperate objects probably makes it easier to deal with 'on entry' and 'on exit' conditions. only having one object makes the association hard. but having two objects makes it possible to for the door to be 'open' on one side, yet impossibly 'closed' on the other - thought even that may be a useful feature. going with seperate for now

The sides `SIDE-a` and `SIDE-b` indicate which of the `LOCATION`s the join connects with. Valid maps do not permit a location to have multiple connections to the same room. So there is exactly _one_ entry refering to the `JOIN` in the `LOCATION` definition. The exit index on the location side is found by searching for the JOIN entry (see below)

An `ACCESS` is _either_ an `EGRESS` from or an `INGRESS` to a `LOCATION`

    LOCATION, SIDE, EXIT

`SIDE` is `NORTH`, `WEST`, `SOUTH` or `EAST` as indices counter clockwise from top-of-page

The current map code calls refers to the joins list as 'corridors' because the implementation doesn't currently deal with adjacent rooms, just those connected by corridors.

Things can be placed on maps. Interacting with those things as an ACTION/OUTCOME relationship

    CONSEQUENCE: [ACTION, OUTCOME]

EXIT: room-side, exit-index
JOINS: [[side-0]]
ROOM: []
PSS: PLAYER-SESSION-SEED : so that each player gets unique tokens for the session
H(PSS, ROOM): TOKEN (location token)
H(PSS, OBJECT): TOKEN (object token)
H(TOKEN, EXIT): TOKEN (next location token)
H(TOKEN:
TOKEN: H(PSS, )

TOKEN : SCENE

SCENE, EXIT : TOKEN

TOKEN, SCENE, EXIT : SCENE

TOKEN : SCENE

TOKEN: VICTORY

Aspirant: I have a TOKEN(i) for this SCENE. I use EXIT(j)
Guardian: I previously committed that when you use EXIT(j) at TOKEN(i)

Guardian: I have previously committed a series of [(TOKEN, EXIT), (TOKEN, EXIT), ... , (TOKEN, VICTORY)]. Ie I have proven there is at least one path on the map that leads to a VICTORY.

Ideal: the guardian does not need to interact on each turn. The moves are provable at any time, but the TOKEN's are not known until each player commits to a move. TOKENS need to be computed for each player so that they are UNIQUE per player.

I have a commitment to

pedersen (nullifier, secret) as per tornado cash. for movement, don't save the nulifier (always allow re spend ?). For consumable traps, save the nullifier

in the torndado cash case the guardian is the depositor and withdrawer. on deposit they are recording the map locations. on withdrawal they are confirming the moves

# new model notes

We currently have

        H(H([[LOCATION, SIDE, EXIT][LOCATION, SIDE, EXIT]]))

We don't put the bi-directionals in currently, so if we have A -> B, we don't
include B -> A. This is anoying in various ways. But particularly because we
don't normalise the order. So it is tempting to do something like this

        H(H(SORT([[LOCATION, SIDE, EXIT][LOCATION, SIDE, EXIT]])))

The A -> B, Action -> Outcome general form makes a lot of sense. And sorting
breaks that. So instead we can just add both directions independently. This does
actually make one-way-doors possible. Being a bit forward looking to when we
include placed items, we will either have separate item placement trie or we can
have an ACTION -> OUTCOME format in what is currently the map trie that allows
for USE-OBJECT style interactions. In addition to USE-EXIT which is what we
currently have.

It would make sense that the participant can create the 'A' side of the node,
this will make the link between the player commitment and the outcome much
clearer

        H([USE-EXIT, [LOCATION, SIDE, EGRESS-EXIT], [LOCATION, SIDE, INGRESS-EXIT]])
        DATA = ROOM-BLOB

The `ROOM-BLOB` is currently

        {
                corridors: [[join-indices], [join-indices], [join-indices], [join-indices]],
                main: true|false,
                inter: true|false,
                x, y, w, l
        }

Player can commit by providing `[COMMIT-SIDE, COMMIT-EGRESS-EXIT]`. The advocate uses their knowlege of the current player location to produce the node

        [CURRENT-LOCATION, COMMIT-SIDE, COMMIT-EGRESS-EXIT][LOCATION, SIDE, INGRESS-EXIT]

And then submits the proof

The exclusion proof would be anoying and, importantly, it would force us to reveal a lot.

We need a second trie for this I think:

trie([LOCATION, SIDE, EXIT])

So we can always show directly that any `[COMMIT-SIDE, COMMIT-EGRESS-EXIT]` is valid or not. not by creating an exclusion proof for this second trie

trie(links)
trie(locations)

We will probably also want

trie(furniture)

We can doubl
