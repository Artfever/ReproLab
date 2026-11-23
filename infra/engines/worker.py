"""ReproLab-authored CPU fixtures. Commands select code fixed at image build time."""
import csv
import json
import os
import resource
import sys
import time
import legacy

OUT = "/work/out"


def pymc2(case):
    import numpy as np
    import pymc
    if case is None:
        return pymc.__version__
    heads, flips = (11, 10) if case == "failure" else (7, 10)
    traces = []
    for seed in (1, 2):
        np.random.seed(seed)
        p = pymc.Uniform("p", lower=0, upper=1, value=0.5)
        observation = pymc.Binomial("heads", n=flips, p=p, value=heads, observed=True)
        chain = pymc.MCMC([p, observation])
        chain.sample(iter=11000, burn=1000, thin=1, progress_bar=False)
        traces.append(chain.trace("p")[:])
    with open(os.path.join(OUT, "traces.csv"), "w") as file:
        writer = csv.writer(file)
        writer.writerow(["chain", "draw", "p"])
        for index, trace in enumerate(traces, 1):
            writer.writerows((index, j, float(p)) for j, p in enumerate(trace, 1))
    flat = np.concatenate(traces)
    return pymc.__version__, {"mean": float(flat.mean()), "sd": float(flat.std(ddof=1)), "draws": int(flat.size)}


def theano(case):
    import numpy as np
    import theano as th
    import theano.tensor as tt
    if case is None:
        return th.__version__
    x, w = tt.dmatrices("x", "w")
    y = tt.dot(x, w)
    f = th.function([x, w], [y, tt.grad((y ** 2).sum(), w)])
    a = np.asarray([[1., 2.], [3., 4.]])
    b = np.asarray([[2.], [-1.]]) if case == "demo" else np.ones((3, 1))
    result, grad = f(a, b)
    return th.__version__, {"output": result.tolist(), "gradient": grad.tolist(), "dtype": str(result.dtype)}


def chainer(case):
    import numpy as np
    import chainer as ch
    from chainer import links
    if case is None:
        return ch.__version__
    model = links.Linear(3, 2)
    model.W.array[:] = [[1, -2, 3], [2, 0, -1]]
    model.b.array[:] = [0.5, -1]
    x = np.asarray([[2, 3, 5]], dtype=np.float32)
    initial = model(x).array.tolist()
    checkpoint = os.path.join(OUT, "checkpoint.npz")
    if case == "failure":
        np.savez(checkpoint, W=np.zeros((2, 2), dtype=np.float32), b=model.b.array)
    else:
        ch.serializers.save_npz(checkpoint, model)
    with np.load(checkpoint, allow_pickle=False) as data:
        if set(data.files) != {"W", "b"} or data["W"].shape != (2, 3) or data["b"].shape != (2,):
            raise ValueError("Checkpoint schema mismatch: expected W[2,3] and b[2].")
    restored = links.Linear(3, 2)
    ch.serializers.load_npz(checkpoint, restored)
    return ch.__version__, {"logits": initial, "restored": restored(x).array.tolist()}


def main():
    engine, case = sys.argv[1:]
    fixtures = {"pymc2": pymc2, "theano": theano, "chainer": chainer,
                "caffe": legacy.caffe, "qiime1": legacy.qiime1, "tophat2": legacy.tophat2,
                "cufflinks": legacy.cufflinks, "niftynet": legacy.niftynet}
    fixture = fixtures[engine]
    if case == "probe":
        print(fixture(None))
        return
    clock = getattr(time, "monotonic", time.time)
    start = clock()
    try:
        version, values = fixture(case)
    except legacy.subprocess.CalledProcessError as error:
        sys.stderr.write(error.output.decode("utf-8", "replace")[-8192:])
        raise
    with open(os.path.join(OUT, "result.json"), "w") as file:
        peak = max(resource.getrusage(who).ru_maxrss for who in (resource.RUSAGE_SELF, resource.RUSAGE_CHILDREN))
        json.dump({"version": version, "values": values, "runtimeS": clock() - start,
                   "peakRssKiB": peak}, file, allow_nan=False)


if __name__ == "__main__":
    main()
