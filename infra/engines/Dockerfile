FROM scratch AS wheelhouse

FROM python:3.8.20-bookworm@sha256:7aa279fb41dad2962d3c915aa6f6615134baa412ab5aafa9d4384dcaaa0af15d AS python-base
ENV HOME=/tmp OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /opt/reprolab
COPY worker.py legacy.py ./
RUN mkdir -p /work/in /work/out && chown -R 10001:10001 /work

FROM python-base AS chainer
RUN --mount=type=bind,from=wheelhouse,target=/wheels \
    pip install --no-cache-dir --find-links=/wheels \
    numpy==1.23.5 chainer==7.8.1 protobuf==3.20.3 filelock==3.13.1 six==1.16.0 typing-extensions==4.12.2
USER 10001

FROM quay.io/biocontainers/qiime@sha256:ccdf61ea66f2dc0ce74592d9292ed67fa36af40a16be753eb62bf56c5a7d550d AS qiime1
ENV HOME=/tmp OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /opt/reprolab
COPY worker.py legacy.py ./
RUN mkdir -p /work/in /work/out && chown -R 10001:10001 /work
ENTRYPOINT []
USER 10001

FROM quay.io/biocontainers/tophat@sha256:15e907a6d9c63847f3a786522f1e6351f02cdf90faef8defa09b88f6fc58b7ff AS tophat2
ENV HOME=/tmp OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /opt/reprolab
COPY worker.py legacy.py ./
RUN mkdir -p /work/in /work/out && chown -R 10001:10001 /work
ENTRYPOINT []
USER 10001

FROM quay.io/biocontainers/cufflinks@sha256:1aa3f262e175a02be21c7d334e9e1a95302426ef98c835595d682da197503cc8 AS cufflinks
ENV HOME=/tmp OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /opt/reprolab
COPY worker.py legacy.py ./
RUN mkdir -p /work/in /work/out && chown -R 10001:10001 /work
ENTRYPOINT []
USER 10001

FROM python:3.7.17-slim-bullseye@sha256:603879aeff06df23f0d392a19f7ce02aa85e14e6b4d25fd9647b116e0cb93467 AS niftynet
ENV HOME=/tmp OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 CUDA_VISIBLE_DEVICES=-1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /opt/reprolab
COPY worker.py legacy.py ./
RUN --mount=type=bind,from=wheelhouse,target=/wheels \
    mkdir -p /work/in /work/out && chown -R 10001:10001 /work \
    && for wheel in /wheels/tensorflow-1.15.5-cp37-*.whl; do \
         if [ -f "$wheel" ]; then \
           echo "29831dda98d668067de75403b2fca0d06a2f026ef6f217fa2ca873c20b4ee4d3  $wheel" | sha256sum -c - \
           && pip install --no-cache-dir --no-deps "$wheel" || exit 1; \
         fi; \
       done \
    && pip install --no-cache-dir tensorflow==1.15.5 niftynet==0.6.0 numpy==1.18.5 scipy==1.5.4 \
       protobuf==3.20.3 nibabel==3.2.2 pillow==9.5.0 scikit-image==0.19.3 pandas==1.3.5 h5py==2.10.0
USER 10001

FROM python-base AS theano
ENV THEANO_FLAGS=device=cpu,floatX=float64,base_compiledir=/tmp/theano,blas.ldflags=
RUN --mount=type=bind,from=wheelhouse,target=/wheels \
    pip install --no-cache-dir --find-links=/wheels numpy==1.23.5 scipy==1.10.1 Theano==1.0.5 six==1.16.0
USER 10001

FROM python-base AS pymc2
ENV FFLAGS=-fallow-argument-mismatch
RUN apt-get update && apt-get install -y --no-install-recommends gfortran libblas-dev liblapack-dev && rm -rf /var/lib/apt/lists/*
RUN --mount=type=bind,from=wheelhouse,target=/wheels \
    pip install --no-cache-dir --find-links=/wheels numpy==1.19.5 scipy==1.5.4 setuptools==59.8.0 wheel==0.41.3 \
    && pip download --no-deps --no-build-isolation pymc==2.3.8 -d /tmp \
    && echo '1dfef8e06d9773f2b0fd44b38d5187d6f4b3393726bb2a5723ca2d3bce1934ab  /tmp/pymc-2.3.8.tar.gz' | sha256sum -c - \
    && pip install --no-cache-dir --no-build-isolation /tmp/pymc-2.3.8.tar.gz \
    && rm /tmp/pymc-2.3.8.tar.gz
USER 10001

FROM ubuntu:20.04@sha256:8feb4d8ca5354def3d8fce243717141ce31e2c428701f6682bd2fafe15388214 AS caffe
ENV HOME=/tmp OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /opt/reprolab
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-caffe-cpu=1.0.0+git20180821.99bd997-5build3 \
    && rm -rf /var/lib/apt/lists/* && mkdir -p /work/in /work/out && chown -R 10001:10001 /work
COPY worker.py legacy.py ./
USER 10001
