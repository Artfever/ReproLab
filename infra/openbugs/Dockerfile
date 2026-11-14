# ReproLab OpenBUGS 3.2.3 worker image.
# Build from the repository root with scripts/build-image.ps1 (or .sh), which checks the tarball first, or directly:
#   docker build --platform linux/amd64 -f infra/openbugs/Dockerfile -t reprolab-openbugs:3.2.3-vendored .
#
# The OpenBUGS source tarball is NOT downloaded during the build. Place it at vendor/OpenBUGS-3.2.3.tar.gz first.
# The build only checks it against the pinned SHA-256 of the copy we tested. The network is used only by Debian apt-get.
ARG BASE=debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc

FROM ${BASE} AS build
ARG OPENBUGS_SHA256=a289c4da0c4ac371f8013226c85ebd0a9e1dec5de9b858950e4854cb814b4ed8
RUN dpkg --add-architecture i386 \
 && apt-get update \
 && apt-get install -y --no-install-recommends build-essential gcc-multilib libc6:i386 \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY vendor/OpenBUGS-3.2.3.tar.gz /src/openbugs.tar.gz
RUN echo "$OPENBUGS_SHA256  openbugs.tar.gz" | sha256sum -c - \
 && tar xzf openbugs.tar.gz
WORKDIR /src/OpenBUGS-3.2.3
RUN ./configure --prefix=/opt/openbugs && make && make install \
 && mkdir -p /opt/openbugs/licenses && cp COPYING AUTHORS NEWS /opt/openbugs/licenses/

FROM ${BASE} AS runtime
RUN dpkg --add-architecture i386 \
 && apt-get update \
 && apt-get install -y --no-install-recommends libc6:i386 python3-minimal libpython3.11-stdlib \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin bugs
COPY --from=build /opt/openbugs /opt/openbugs
COPY services/runner/reprolab_runner /opt/reprolab/reprolab_runner
ENV PYTHONPATH=/opt/reprolab PYTHONDONTWRITEBYTECODE=1 PATH=/opt/openbugs/bin:$PATH
RUN mkdir -p /work && chown 10001:10001 /work
USER 10001
WORKDIR /work