# Migration run mig-2026-09-30T07-40-28-710Z-6d2cfc1c

- Target: local MongoDB database "islammalayalam_migration" + ./media-migration/ (dry run — nothing written)
- Started: 2026-09-30T07:40:28.711Z
- Finished: 2026-09-30T07:40:31.437Z

| Entity | Source | Excluded (demo) | Created | Updated | Unchanged | Quarantined | Rejected |
|---|---|---|---|---|---|---|---|
| category | 24 | 14 | 0 | 0 | 10 | 0 | 0 |
| author | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| media | 458 | 0 | 0 | 0 | 452 | 0 | 0 |
| page | 140 | 34 | 0 | 0 | 106 | 0 | 0 |
| post | 513 | 24 | 0 | 2 | 487 | 0 | 0 |
| redirect | 72 | 0 | 0 | 0 | 72 | 0 | 0 |
| menu | 1 | 0 | 0 | 0 | 1 | 0 | 0 |

## Rejected (0)
- none

## Quarantined (0)
- none

## Needs review / warnings (164)
- **post: title written from the first sentence** (94): #2468, #2538, #2751, #2865, #2869, #3099, #3142, #3251, #3596, #3622, #3637, #3644, #3653, #3658, #3660, #3675, #3690, #3701, #3708, #3711, #3715, #3719, #3727, #3730, #3743, #3746, #3750, #3753, #3764, #3789, #3792, #3795, #3798, #3801, #3813, #3816, #3819, #3822, #3844, #3848, #3851, #3854, #3857, #3860, #3879, #3882, #3889, #3892, #3895, #3898, #3901, #3904, #3929, #3939, #3942, #3945, #3968, #3971, #3974, #3976, #3979, #3981, #3994, #4015, #4018, #4021, #4024, #4027, #4029, #4032, #4035, #4038, #4041, #4054, #4057, #4103, #4116, #4120, #4175, #4178, #4181, #4184, #4226, #4229, #4232, #4235, #4238, #4241, #4275, #4278, #4281, #4284, #4287, #4290
- **post: video link was kept in a WordPress plugin** (24): #861, #864, #867, #870, #873, #876, #879, #882, #884, #887, #890, #893, #897, #900, #903, #906, #1427, #1431, #2310, #2661, #2668, #2855, #2886, #3124
- **post: publish date was tampered in WordPress (2026-07-02); estimated** (10): #2407, #2468, #2538, #2548, #2865, #2869, #3099, #3142, #3163, #3395
- **page: video element without a YouTube link removed** (8): #715, #755, #1114, #1115, #1118, #1121, #1123, #1125
- **page: same text as page #1114** (5): #1115, #1118, #1121, #1123, #1125
- **post: e-book has no PDF** (5): #2995, #3496, #3503, #3510, #3517
- **post: audio link was kept in a WordPress plugin** (4): #2303, #2313, #2316, #2319
- **page: link removed, text kept** (3): #627, #643, #296
- **post: 1 image(s) could not be kept (dead host or failed file checks)** (3): #2699, #4298, #4303
- **category: slug normalised (invisible characters removed); old URL redirects** (2): #22, #90
- page #220: builder element "td_block_ad_box" removed
- page #755: same text as page #715: check which page it belongs to
- post #2672: no category
- post #3142: 5 image(s) could not be kept (dead host or failed file checks)
- post #3172: publish date was tampered in WordPress (0020-02-08); estimated
- post #4306: 2 image(s) could not be kept (dead host or failed file checks)
