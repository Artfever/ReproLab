# Run states

## The six states

Every run is in exactly one state: queued, running, succeeded, engine_error, timed_out or runner_error. The Results page shows the state as a word, not only a colour.

## Success is decided from the log

The engine can exit with status 0 even when the model is invalid. For that reason ReproLab never decides success from an exit code. A run counts as succeeded only when the log contains none of the known error messages, contains these engine messages in order, and every expected output file exists and is not empty. There are seven required messages, in this order. First "model is syntactically correct", then "data loaded", then "model compiled". After those come "model is initialized" and "updates took". The last two are "Node statistics" and "CODA files written".

## engine_error

The engine ran but the log shows a problem or lacks an expected message, or the engine exited with a non-zero status. Known problem patterns are an error position report such as error pos 58, the words is not defined, a line starting with model must, an unknown script command, and the text Sorry something went wrong. The first matching log line is given as the reason.

## timed_out

The engine did not finish within your timeout and was killed. The log stops at the last message it printed.

## runner_error

The run could not be judged because of a problem outside the engine. Examples: Docker is not installed or not running, the image is missing, the container ended without a readable manifest, or the server-side limit fired. Look at the reason text for the missing item.

## queued and running

A run is queued for a moment after it is accepted and then running. The Results page checks again every one to two seconds and announces each change.

## Failed runs stay visible

The saved files of a failed run are kept so that its log can still be read.
