# Setup

## What you need installed

ReproLab runs on your own computer. You need Node 24.x to run the local server and Docker to run the engine. On Windows use Docker Desktop with WSL2. On Linux use Docker Engine. Git is needed to clone the repository. Python is used only inside the container image, so you do not install it yourself.

## The engine image

The engine runs inside a local Docker image, by default named reprolab-openbugs:3.2.3. The repository does not contain the OpenBUGS engine or the image. You build the image yourself from an OpenBUGS 3.2.3 Linux source tarball that you download in a browser and place at vendor/OpenBUGS-3.2.3.tar.gz. The build script checks the file's SHA-256 against the value ReproLab tested and stops if it differs.

## Choosing another image tag

Set the environment variable REPROLAB_IMAGE on the server to use a different image tag. The tag can only be set on the server. The web page cannot send an image name.

## Starting the server

Start the server with the start script or with npm start in apps/local. It listens on 127.0.0.1 only. The default port is 8765 and REPROLAB_PORT changes it. There is no setting that makes the server listen on another network address.

## Checking that everything is ready

The health page of the server reports whether Docker is installed and running and whether the image is present. If Docker is stopped or the image is missing, a run ends in the state runner_error with a reason that names the missing item.

## Resetting

The reset script deletes saved runs and temporary files under local-data and removes leftover containers that carry the reprolab.run label. It does not touch tracked files or your own copy of the Seeds files.
