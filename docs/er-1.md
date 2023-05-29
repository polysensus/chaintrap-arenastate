## User / Guardian / Trialist

The key details are:

1. The `Guardian` has access to the `Trial` and the `Map`
2. The `Guardian` records a `Journal` just like the `Trialist`s will.
3. `Outcome`s are emmited from the contracts. They are visible to all.

4. The `Trialist` does not have any access to the map
5. The `Outcomes` are visible to all `Trialists`, but, depending on how they are encoded, may not be decipherable - in part or in full.
6. The `Journal` will have some knowlege of other `Trialists`, at least how many there are, and whether the other trialists have any `NewChoices` in their latest `Outcome`

We don't think there is a one size suites all answer to move secrecy. Various options are possible. The scene data may be blinded or encrypted. Basic ecdh key exchange is possible to establish shared secrets at the start of a trial for example. The choices are hashes already. To avoid correlation, the map nodes can be salted for each player - so the map is a full graph of all choices duplicated once per player. Leaving the moves completely transparent to all observers will make the game feel more like a race and allows players to be easily shown to be in the same location at the same time. The guardian dictates the pace of play because they must supply the proof. For 'programmer' games, the guardian can be automated, and the challenge is then to write a bot that analysies the available game states faster than other bots. For human games, the presence of human guardian means the bots can't out pace the humans.

```mermaid
erDiagram
    User 1 -- 1+ Trialist: is
    Trialist 1 -- 1 Journal: updates
    Journal 1 -- 1 StateRoster: has
    Journal 1..1+ Outcome: consumes
    Outcome {
        number Outcome
        merkle proof
        data Scene
        set NewChoices
    }
    Trial 1--1+Outcome: proves
    StateRoster 1--1+ TrialistState : contains


    User 1 -- 1+ Guardian: is
    User 1 .. 0+ Map: creates
    Guardian 1 -- 1 Journal: updates
    Journal 1 -- 1 StateRoster: has
    Journal 1..1+ Outcome: consumes
    Guardian 1 -- 1 Trial: operates
    StateRoster 1--1+ TrialistState : contains
    Trial 1--1 Map: uses

```

## User / Guardian

The key details are:

1. The `Guardian` has access to the `Trial` and the `Map`
2. The `Guardian` records a `Journal` just like the `Trialist`s will.
3. `Outcome`s are emmited from the contracts. They are visible to all.

We don't think there is a one size suites all answer to move secrecy. Various options are possible. The scene data may be blinded or encrypted. The choices are hashes already. To avoid correlation, the map nodes can be salted for each player - so the map is a full graph of all choices duplicated once per player. Leaving the moves completely transparent to all places will make the game feel more like a race and allows players to be easily shown to be in the same location at the same time.

```mermaid
erDiagram
    Automation 1 .. 1+ Guardian: automates
    User 1 -- 1+ Guardian: is
    User 1 .. 0+ Map: creates
    Guardian 1 -- 1 Journal: updates
    Journal 1 -- 1 StateRoster: has
    Journal 1..1+ Outcome: consumes
    Outcome {
        number Outcome
        merkle proof
        data Scene
        set NewChoices
    }
    Guardian 1 -- 1 Trial: operates
    Trial 1--1+Outcome: proves
    StateRoster 1--1+ TrialistState : contains
    Trial 1--1 Map: uses
```

## User / Trialist

Key details,

1. The `Trialist` does not have any access to the map
2. The `Outcomes` are visible to all `Trialists`, but, depending on how they are encoded, may not be decipherable - in part or in full.
3. The `Journal` will have some knowlege of other `Trialists`, at least how many there are, and whether the other trialists have any `NewChoices` in their latest `Outcome`

```mermaid
erDiagram
    User 1 -- 1+ Trialist: is
    Trialist 1 -- 1 Journal: records
    Journal 1 -- 1 StateRoster: has
    Journal 1..1+ Outcome: consumes
    Outcome {
        number Outcome
        merkle proof
        data Scene
        set NewChoices
    }
    Trialist 1 .. 1 Trial: participates
    Trial 1--1+Outcome: proves
    StateRoster 1--1+ TrialistState : contains
```

- Automation for taking `Guardian` turns is likely. In this case, we say the `Automation` is an `Advocate`. This isn't represented in these diagrams.
- No plan to automate game creation at this time.
- The `Trial` is the physical environment for a `Game`. It sort of exists independently as the implicit container for the map, the merkle tries used to prove moves, and the association with the `Game`
- The `Trial` has a life cycle independent to the `Game`
