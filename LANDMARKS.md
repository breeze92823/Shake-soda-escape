# Lobby Landmarks

Coordinates are metres from `src/config.js`: **+X east, +Z south, +Y up**. Spawn is the origin, facing north (−Z) toward the tower. The arena is 52 m wide (X −26…26) and 58 m deep (Z −36…22), walled all round.

## Map

Top-down, north at the top. One column = 1 m east–west, one row = 2 m north–south.

```
                      N
+-----------------------------------------------------+
|                                                     |
|                                                     |
|.............                                        |
|.............         #########         ......:::::::|
|.............    P    #########     V   ......:::::::|
|.............         #########         ......:::::::|
|.............         #########         ......:::o:::|
|......6......         #########         ......:::::::|
|.............         #########         ......:::::::|
|.............             L             ...o..:::o:::|
|......5......                           ......:::::::|
|.............                           ...o..:::o:::|
|.............                           ......:::::::|
|......4......                           ......:::::::|
|.............                           ...o..:::o:::|
|.............                           ......:::::::|
|......3......                           ...o..:::::::|
|.............                           ......:::o:::|
|.............             S             ......:::::::|
|......2......                           ...o..:::o:::|
|.............                           ......:::::::|
|.............                           ......:::::::|
|......1......                           ......:::o:::|
|.............                           ......:::::::|
|.............                           ......:::::::|
|.............                           ......:::::::|
|.............              C            ......:::::::|
|                                                     |
|                                                     |
|                    R             T                  |
+-----------------------------------------------------+
 W                                                   E
                      S (south wall)
```

| Key | Landmark |
| --- | --- |
| `S` | Player spawn |
| `#` | Soda Jump tower |
| `L` | Launch pad |
| `P` | World 2 portal |
| `V` | Void Soda NPC |
| `1`–`6` | Soda multiplier treadmills (x1 south … x32 north) |
| `.` | Red platforms: west treadmill shop and east display front tier |
| `:` | East display raised back tier |
| `o` | Soda display items (5 front, 7 back) |
| `C` | FREE chest |
| `R` / `T` | Top Rebirths / Top Soda leaderboards (south wall) |

## Landmark details

| Landmark | Position (x, z) | Notes |
| --- | --- | --- |
| Spawn | (0, 0) | Faces north toward the tower. |
| Soda Jump tower | (0, −25) | 9 m square, 24 segments of 7 m, numbered every 20. |
| Launch pad | (0, −17.6) | Radius 2.3 m, at the tower's foot. |
| World 2 portal | (−9, −27) | North-west, beside the tower. |
| Void Soda NPC | (10, −27) | North-east, beside the tower. |
| Multiplier treadmills | x = −20.5; z = 8, 2, −4, −10, −16, −22 | Platform X −26…−14, Z −31…15, 0.4 m high, square ends. |
| Soda display, front tier | items at x = 17.2; z = −18.6, −13.4, −8.2, −3, 2.1 | Platform from x = 14, 0.5 m high. |
| Soda display, back tier | items at x = 23.3; z = −23.9, −18.5, −13.2, −7.8, −2.5, 2.9, 8.2 | Platform from x = 20.5, 1.1 m high. Both tiers span Z −30…15 with 4 m ramped ends. |
| FREE chest | (1, 17) | Between the two leaderboards. |
| Top Soda board | (8, 21.3) | South wall. |
| Top Rebirths board | (−6, 21.3) | South wall. |

Source of truth: `ARENA`, `TOWER`, `LAUNCH_PAD`, `PORTAL`, `VOID_NPC`, `DISPLAY`, `SHOP`, `SOUTH` in [src/config.js](src/config.js). Update this file if those change.
