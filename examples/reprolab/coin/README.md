# Coin demonstration

This model was written by the ReproLab project. It is not copied from any upstream example set.

A coin is tossed 10 times and lands heads 7 times. The prior for the heads probability `p` is uniform, Beta(1, 1).

## Files

- `model.txt`: `r ~ dbin(p, n)` with `p ~ dbeta(1, 1)`.
- `data.txt`: `r = 7`, `n = 10`.
- `inits1.txt`, `inits2.txt`: starting values `p = 0.3` and `p = 0.8`, one per chain.

Monitor `p`.

## Analytic reference

The posterior is Beta(1 + 7, 1 + 3) = Beta(8, 4).

- Mean: 8 / 12 = 0.6667
- Standard deviation: sqrt(32 / (144 * 13)) = about 0.1307

## Expected agreement

Sampled values are random draws, so they agree with the analytic values only within a tolerance. The tolerance is an absolute difference of 0.01 for the mean and 0.01 for the standard deviation.

The check uses 2 chains, 1000 burn-in, 10000 samples and seed 1. Passing this check shows that the engine ran this small model as expected. It does not validate any other model.
