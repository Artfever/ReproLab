# Privacy

## Where your data stays

Your model, data and initial values are sent from your browser to the server on your own computer and stored under local-data/runs. The engine container has no network access. ReproLab has no accounts, no analytics and no remote scripts, styles, fonts or images.

## The server is local only

The server listens on 127.0.0.1. It rejects requests whose Host or Origin header is not a local address. Other machines on your network cannot reach it.

## The optional language model

The only data that can leave your machine is a call to the language-model endpoint you configure yourself. That call contains your question and the text of the retrieved passages. The passages are ReproLab documents and, if you picked a run, that run's log lines and manifest fields. Your model file and data files are not sent, unless a line of the log happens to quote some of their content. If you point the setting at a remote service, that service receives this text. Use a local endpoint such as Ollama if you want it to stay on your machine.

## Keys

An API key is read from the environment of the server. It is not stored in a file, shown in the page, put in a manifest or written to a log.

## Paths

Responses, logs and manifests replace your home folder and repository folder with the text <local-path>, so a downloaded manifest does not reveal where your files live.

## Deleting data

Saved runs stay on disk until you delete them. The reset script removes saved runs and temporary files. You can also delete a run folder under local-data/runs by hand.
