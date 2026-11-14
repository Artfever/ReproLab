# Input checks and messages

## When checks happen

The Run page checks your values in the browser before you submit. The server then checks the same values again, and the validate request reports every problem without starting a container. If any problem exists, a run is not created and the server answers 400 with the list. Each problem names the field and gives a plain sentence.

## Numeric ranges

Every number must be an integer. Chains: 1 to 4. Burn-in: 0 to 50000. Samples: 1 to 50000. Thin: 1 to 100. Seed: 1 to 14. Timeout: 1 to 300 seconds. The Python runner accepts the same ranges, except that its own timeout limit is 3600 seconds and the local server limits it to 300.

## Monitors

You need 1 to 25 monitor names. Each name starts with a letter, then may contain letters, digits, underscore and dot, up to 64 characters in all. Duplicate names are rejected.

## Files

The model may be 1 to 262144 bytes. Each data or initial-values file may be 1 to 2097152 bytes. Files must be plain ASCII with no NUL byte. A file with accented letters or other non-ASCII characters is rejected, and so is an empty file. Remove or replace those characters in a text editor and try again.

## One inits file per chain

The number of initial-values files must equal the number of chains. Two chains need two files.

## Unknown fields

A request that contains a field the server does not know is rejected, and the problem names that field. The server never accepts a file path, an image name, a container option or a command from the page.

## Validation is not model checking

These checks look only at sizes, characters and ranges. They do not parse the OpenBUGS model. A syntax error in the model is found by the engine itself and shows up as the state engine_error.
