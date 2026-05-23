import pandas as pd
import numpy as np
from pathlib import Path
p = Path('APTOS/cleaned/train_clean.csv')
if not p.exists():
    print('ERROR: train_clean.csv not found at', p)
    raise SystemExit(1)

df = pd.read_csv(p)
counts = df['diagnosis'].value_counts().sort_index()
total = len(df)
num_classes = 5
print('Total samples:', total)
print('Counts per class:')
for i in range(num_classes):
    print(f'  Class {i}:', counts.get(i,0))
print('\nOriginal proportions:')
for i in range(num_classes):
    print(f'  Class {i}: {counts.get(i,0)/total:.4f}')

# sampler weights as implemented (without clipping)
sample_w = {i: total/(num_classes * counts.get(i,1)) for i in range(num_classes)}
# expected proportion when sampling with these sample weights: (count_i * w_i) / sum(count_j * w_j)
num = np.array([counts.get(i,0)*sample_w[i] for i in range(num_classes)], dtype=float)
den = num.sum()
print('\nSampler expected proportions (no clipping):')
for i in range(num_classes):
    print(f'  Class {i}: {num[i]/den:.4f}')

# class weights used for loss (from printed run)
class_weights = np.array([0.4082474,1.9659574,0.7266055,3.7972603,2.4860988])
# loss contribution proportion ~ weight * count
loss_num = class_weights * np.array([counts.get(i,0) for i in range(num_classes)], dtype=float)
loss_den = loss_num.sum()
print('\nLoss contribution proportions (alpha * count):')
for i in range(num_classes):
    print(f'  Class {i}: {loss_num[i]/loss_den:.4f}')

# Show rounded expected per-class sample count when sampler used with replacement and num_samples=total
expected_per_class = (num/den) * total
print('\nExpected sample counts per class with sampler (approx):')
for i in range(num_classes):
    print(f'  Class {i}: {expected_per_class[i]:.1f}')
