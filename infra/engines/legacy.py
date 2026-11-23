"""Authored fixed-input workflows for legacy CPU runtimes."""
from __future__ import print_function

import glob
import gzip
import os
import re
import struct
import subprocess
from collections import Counter
from random import Random

OUT = "/work/out"


def run(*args):
    return subprocess.check_output(args, stderr=subprocess.STDOUT).decode("utf-8", "replace")


def write(name, contents):
    with open(name, "w") as file:
        file.write(contents)


def checked_version(command, expected):
    output = run(*command)
    if not re.search(r"(?<![\d.])" + re.escape(expected) + r"(?![\d.])", output):
        raise ValueError("Unexpected version: " + output)
    return expected


def caffe(case):
    import caffe as engine
    import numpy as np
    version = engine.__version__
    if version == "1.0.0":
        version = "1.0"
    if case is None:
        return version
    engine.set_mode_cpu()
    write("/tmp/model.prototxt", '''
name: "reprolab_fixture"
input: "x"
input_shape { dim: 1 dim: 1 dim: 2 dim: 3 }
layer { name: "fc" type: "InnerProduct" bottom: "x" top: "scores"
        inner_product_param { num_output: 2 } }
''')
    net = engine.Net("/tmp/model.prototxt", engine.TEST)
    net.params["fc"][0].data[:] = [[1, 0, -1, 2, 0, 3], [0, 1, 0, -1, 2, 0]]
    net.params["fc"][1].data[:] = [0.5, -1]
    shape = (1, 1, 2, 3) if case == "demo" else (1, 1, 3, 2)
    tensor = np.arange(1, 7, dtype=np.float32).reshape(shape)
    if tensor.shape != net.blobs["x"].data.shape:
        raise ValueError("Input must have the NCHW shape [1, 1, 2, 3].")
    return version, {"scores": net.forward(x=tensor)["scores"].tolist(),
                     "shape": list(tensor.shape), "layout": "NCHW"}


def qiime1(case):
    import qiime
    version = qiime.__version__
    if case is None:
        return version
    import biom
    import numpy as np
    table = biom.Table(np.array([[1, 4], [2, 0], [3, 5]]), ["f1", "f2", "f3"],
                       ["A", "B"], observation_metadata=[
                           {"taxonomy": ["k__Artificial", "p__" + name]} for name in ("f1", "f2", "f3")])
    write("/tmp/table.biom", table.to_json("ReproLab") if case == "demo" else '{"invalid":true}')
    run("summarize_taxa.py", "-i", "/tmp/table.biom", "-o", "/tmp/taxa", "-L", "2", "-a")
    with open("/tmp/taxa/table_L2.txt") as file:
        summary = file.read()
    write(OUT + "/counts.tsv", summary)
    rows = [line.split("\t") for line in summary.splitlines() if line.startswith("k__")]
    return version, {"sampleTotals": [sum(float(row[i]) for row in rows) for i in (1, 2)],
                     "featureTotals": [sum(float(v) for v in row[1:]) for row in sorted(rows)],
                     "featureCount": len(rows)}


def artificial_reference():
    random = Random(74)
    return "".join("ACGT"[int(random.random() * 4)] for _ in range(1200))


def bam_references(path):
    """Read reference IDs from the small BAM emitted by the fixture."""
    with gzip.open(path, "rb") as file:
        if file.read(4) != b"BAM\1":
            raise ValueError("Missing BAM header.")
        number = lambda: struct.unpack("<i", file.read(4))[0]
        text_size = number()
        if not 0 <= text_size <= 65536:
            raise ValueError("Invalid BAM header size.")
        file.read(text_size)
        if number() != 1:
            raise ValueError("Expected one BAM reference.")
        if number() != 11 or file.read(11) != b"artificial\0" or number() != 1200:
            raise ValueError("Alignment reference does not match the artificial fixture.")
        refs = []
        for _ in range(100):
            prefix = file.read(4)
            if not prefix:
                return refs
            size = struct.unpack("<i", prefix)[0]
            if not 32 <= size <= 65536:
                raise ValueError("Invalid BAM record size.")
            block = file.read(size)
            if len(block) != size or struct.unpack_from("<i", block)[0] != 0:
                raise ValueError("Invalid BAM record or reference ID.")
            refs.append("artificial")
        raise ValueError("Too many BAM fixture records.")


def tophat2(case):
    version = checked_version(("tophat", "--version"), "2.1.1")
    if case is None:
        return version
    sequence = artificial_reference()
    write("/tmp/reference.fa", ">artificial\n" + sequence + "\n")
    run("bowtie2-build", "/tmp/reference.fa", "/tmp/reference")
    reads = "".join("@toy%d\n%s\n+\n%s\n" % (i, sequence[i:i+70], "I"*70) for i in (20, 35, 50, 65))
    write("/tmp/reads.fq", reads if case == "demo" else "@bad\nXY\n+\n")
    run("tophat", "--no-novel-juncs", "--no-coverage-search", "-p", "1", "-o", "/tmp/alignment",
        "/tmp/reference", "/tmp/reads.fq")
    path = "/tmp/alignment/accepted_hits.bam"
    records = bam_references(path)
    if not records:
        raise ValueError("TopHat produced no accepted alignment records.")
    import shutil
    shutil.copyfile(path, OUT + "/accepted_hits.bam")
    ids = Counter(records)
    return version, {"records": len(records), "reference": ",".join(sorted(ids))}


def cufflinks(case):
    try:
        banner = run("cufflinks", "--help")
    except subprocess.CalledProcessError as error:
        if error.returncode != 1:
            raise
        banner = error.output.decode("utf-8", "replace")
    if not re.search(r"^cufflinks v2\.2\.1\s*$", banner, re.MULTILINE):
        raise ValueError("Cufflinks did not report the expected release.")
    version = "2.2.1"
    if case is None:
        return version
    sequence = artificial_reference()
    sam = "@HD\tVN:1.0\tSO:coordinate\n@SQ\tSN:artificial\tLN:1200\n"
    for i in range(20, 100, 5):
        sam += "toy%d\t0\tartificial\t%d\t60\t70M\t*\t0\t0\t%s\t%s\tNH:i:1\n" % (
            i, i+1, sequence[i:i+70], "I"*70)
    write("/tmp/synthetic.sam", sam if case == "demo" else "invalid alignment\n")
    alignment = "/work/in/accepted_hits.bam" if case == "linked" else "/tmp/synthetic.sam"
    run("cufflinks", "--no-update-check", "--min-frags-per-transfrag", "1",
        "-p", "1", "-m", "70", "-s", "1", "-o", "/tmp/assembly", alignment)
    table = glob.glob("/tmp/assembly/isoforms.fpkm_tracking")
    if not table:
        raise ValueError("Cufflinks did not produce an isoform table.")
    import shutil
    shutil.copyfile(table[0], OUT + "/isoforms.tsv")
    with open(table[0]) as file:
        rows = file.read().splitlines()
    header = rows[0].split("\t")
    parsed = [dict(zip(header, row.split("\t"))) for row in rows[1:]]
    if not parsed or not {"tracking_id", "locus", "FPKM", "FPKM_status"}.issubset(header):
        raise ValueError("The Cufflinks isoform table is empty or malformed.")
    return version, {"isoforms": len(parsed), "positive": sum(float(row["FPKM"]) > 0 for row in parsed)}


def niftynet(case):
    import niftynet as engine
    import numpy as np
    import tensorflow as tf
    from niftynet.layer.convolution import ConvolutionalLayer
    from PIL import Image
    version = engine.__version__
    if case is None:
        return version
    volume = np.arange(24, dtype=np.float32).reshape(1, 2, 3, 4, 1)
    layer = ConvolutionalLayer(1, kernel_size=1, with_bias=False, feature_normalization=None,
                               w_initializer=tf.constant_initializer(2.0))
    result = layer(tf.constant(volume), is_training=False)
    saver = tf.train.Saver()
    config = tf.ConfigProto(intra_op_parallelism_threads=1, inter_op_parallelism_threads=1,
                            device_count={"GPU": 0})
    prefix = "/tmp/reprolab-checkpoint"
    with tf.Session(config=config) as session:
        session.run(tf.global_variables_initializer())
        saver.save(session, prefix)
    with tf.Session(config=config) as session:
        saver.restore(session, prefix if case == "demo" else prefix + "-missing")
        samples = session.run(result)[0, :, :, :, 0]
    np.save(OUT + "/volume.npy", samples, allow_pickle=False)
    Image.fromarray(samples[0].astype(np.uint8)).resize((160, 120), Image.NEAREST).save(OUT + "/slice.png")
    return version, {"shape": list(samples.shape), "sum": float(samples.sum()), "range": [float(samples.min()), float(samples.max())]}
