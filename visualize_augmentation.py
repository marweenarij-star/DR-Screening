"""
Visualize class distribution before and after data augmentation
"""
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# Load data
df_before = pd.read_csv('archive/unused/APTOS/cleaned/train_clean.csv')
df_after = pd.read_csv('archive/unused/APTOS/cleaned/train_balanced.csv')

# Get class counts
before_counts = df_before['diagnosis'].value_counts().sort_index()
after_counts = df_after['diagnosis'].value_counts().sort_index()

# Grade labels
grades = ["No DR", "Mild", "Moderate", "Severe", "Proliferative DR"]
colors = ['#2ecc71', '#f39c12', '#e74c3c', '#c0392b', '#8b0000']

# Create figure with two subplots
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))

# Before augmentation
bars1 = ax1.bar(range(5), before_counts.values, color=colors, edgecolor='black', linewidth=1.5)
ax1.set_xlabel('DR Grade', fontsize=12, fontweight='bold')
ax1.set_ylabel('Number of Images', fontsize=12, fontweight='bold')
ax1.set_title('BEFORE Augmentation\n(Imbalanced Dataset)', fontsize=14, fontweight='bold')
ax1.set_xticks(range(5))
ax1.set_xticklabels(grades, fontsize=10)
ax1.grid(axis='y', alpha=0.3, linestyle='--')

# Add value labels on bars
for i, (bar, val) in enumerate(zip(bars1, before_counts.values)):
    percentage = (val / before_counts.sum()) * 100
    ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 20, 
             f'{val}\n({percentage:.1f}%)', ha='center', fontsize=10, fontweight='bold')

# After augmentation
bars2 = ax2.bar(range(5), after_counts.values, color=colors, edgecolor='black', linewidth=1.5)
ax2.set_xlabel('DR Grade', fontsize=12, fontweight='bold')
ax2.set_ylabel('Number of Images', fontsize=12, fontweight='bold')
ax2.set_title('AFTER Augmentation\n(Balanced Dataset)', fontsize=14, fontweight='bold')
ax2.set_xticks(range(5))
ax2.set_xticklabels(grades, fontsize=10)
ax2.grid(axis='y', alpha=0.3, linestyle='--')

# Add value labels on bars
for i, (bar, val) in enumerate(zip(bars2, after_counts.values)):
    percentage = (val / after_counts.sum()) * 100
    ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 20, 
             f'{val}\n({percentage:.1f}%)', ha='center', fontsize=10, fontweight='bold')

# Set same y-axis limit for comparison
max_y = max(before_counts.max(), after_counts.max())
ax1.set_ylim(0, max_y * 1.15)
ax2.set_ylim(0, max_y * 1.15)

# Add summary stats
fig.text(0.5, 0.02, 
         f'Before: {before_counts.sum()} images   →   After: {after_counts.sum()} images (+{after_counts.sum() - before_counts.sum()} images, +{((after_counts.sum() - before_counts.sum()) / before_counts.sum() * 100):.0f}%)',
         ha='center', fontsize=11, fontweight='bold', color='#34495e')

plt.tight_layout(rect=[0, 0.04, 1, 1])
plt.savefig('augmentation_comparison.png', dpi=300, bbox_inches='tight')
print("✅ Chart saved as 'augmentation_comparison.png'")
plt.show()
