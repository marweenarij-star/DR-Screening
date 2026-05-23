#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Génère 3 images séparées pour les 3 étapes du pipeline de prétraitement
Partie 1 : Dataset initial (3662 images)
Partie 2 : Après nettoyage (~3360 images)
Partie 3 : Après augmentation (8515 images)
"""

import matplotlib.pyplot as plt
import numpy as np


CLASSES = ['Pas de RD\n(0)', 'Léger\n(1)', 'Modéré\n(2)', 'Sévère\n(3)', 'Prolifératif\n(4)']
COLORS = ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e']


def setup_style():
    """Style global pour un rendu propre et lisible dans le rapport."""
    plt.rcParams.update({
        'figure.facecolor': 'white',
        'axes.facecolor': 'white',
        'axes.edgecolor': '#333333',
        'axes.labelsize': 12,
        'axes.titlesize': 14,
        'xtick.labelsize': 11,
        'ytick.labelsize': 11,
        'font.size': 11,
    })


def format_axes(ax):
    """Formatage commun des axes."""
    ax.grid(axis='y', linestyle='--', linewidth=0.8, alpha=0.25)
    ax.set_axisbelow(True)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

def generate_stage1_raw():
    """Étape 1 : Présentation du dataset brut et distribution initiale"""
    fig, ax = plt.subplots(figsize=(11, 7))

    counts = [1703, 326, 793, 269, 292]
    percentages = [48.6, 9.3, 22.6, 7.7, 8.3]

    bars = ax.bar(CLASSES, counts, color=COLORS, edgecolor='#222222', linewidth=1.2)

    for bar, count, pct in zip(bars, counts, percentages):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{count}\n({pct}%)',
                ha='center', va='bottom', fontsize=10, fontweight='bold')

    ax.set_ylabel('Nombre d\'images', fontweight='bold')
    ax.set_xlabel('Classes de rétinopathie diabétique', fontweight='bold')
    ax.set_title('Étape 1 : Dataset APTOS Initial (3662 images)\nDistribution Initiale Fortement Déséquilibrée',
                 fontweight='bold', pad=16)

    format_axes(ax)
    ax.set_ylim(0, 1900)

    # Résumé minimal pour éviter de surcharger la figure.
    ax.text(0.02, 0.97, 'Déséquilibre max/min = 6,33:1', transform=ax.transAxes,
            fontsize=10, verticalalignment='top',
            bbox=dict(boxstyle='round,pad=0.25', facecolor='#f7f7f7', edgecolor='#cccccc'))

    plt.tight_layout()
    plt.savefig('distribution_stage1_raw.png', dpi=400, bbox_inches='tight')
    print("✅ Image Étape 1 (Dataset Initial) : distribution_stage1_raw.png")
    plt.close()

def generate_stage2_cleaning():
    """Étape 2 : Distribution après nettoyage et suppression des images de mauvaise qualité"""
    fig, ax = plt.subplots(figsize=(11, 7))

    counts_before = [1703, 326, 793, 269, 292]
    counts_after = [1561, 299, 727, 247, 268]
    removed = [count_b - count_a for count_b, count_a in zip(counts_before, counts_after)]
    percentages_removed = [f'-{removed_count} ({removed_count/count_b*100:.1f}%)'
                          for removed_count, count_b in zip(removed, counts_before)]

    x = np.arange(len(CLASSES))
    width = 0.35

    bars1 = ax.bar(x - width/2, counts_before, width, label='Avant nettoyage', 
                   color=COLORS, alpha=0.35, edgecolor='#222222', linewidth=1.0)
    bars2 = ax.bar(x + width/2, counts_after, width, label='Après nettoyage',
                   color=COLORS, alpha=0.95, edgecolor='#222222', linewidth=1.0)

    for bar in bars1:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{int(height)}',
                ha='center', va='bottom', fontsize=9, color='#666666')

    for i, bar in enumerate(bars2):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{int(height)}\n{percentages_removed[i]}',
                ha='center', va='bottom', fontsize=8.5, fontweight='bold')

    ax.set_ylabel('Nombre d\'images', fontweight='bold')
    ax.set_xlabel('Classes de rétinopathie diabétique', fontweight='bold')
    ax.set_title('Après nettoyage et suppression des images de mauvaise qualité\n(~3360 images restantes)',
                 fontweight='bold', pad=16)
    ax.set_xticks(x)
    ax.set_xticklabels(CLASSES)
    ax.legend(fontsize=10, loc='upper right', frameon=False)

    format_axes(ax)
    ax.set_ylim(0, 1900)
    ax.text(0.02, 0.97, 'Suppression totale: 302 images (8,3 %)', transform=ax.transAxes,
            fontsize=10, verticalalignment='top',
            bbox=dict(boxstyle='round,pad=0.25', facecolor='#f7f7f7', edgecolor='#cccccc'))

    plt.tight_layout()
    plt.savefig('distribution_stage2_cleaning.png', dpi=400, bbox_inches='tight')
    print("✅ Image Étape 2 (Après Nettoyage) : distribution_stage2_cleaning.png")
    plt.close()

def generate_stage3_augmentation():
    """Étape 3 : Distribution après augmentation (parfaitement équilibrée)"""
    fig, ax = plt.subplots(figsize=(11, 7))

    counts_before = [1561, 299, 727, 247, 268]
    counts_after = [1703, 1703, 1703, 1703, 1703]
    x = np.arange(len(CLASSES))

    # Version épurée : affichage de la distribution finale uniquement.
    bars = ax.bar(x, counts_after, width=0.62,
          color=COLORS, alpha=0.95, edgecolor='#222222', linewidth=1.0)

    for bar in bars:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
        f'{int(height)}',
        ha='center', va='bottom', fontsize=10, fontweight='bold')

    ax.set_ylabel('Nombre d\'images', fontweight='bold')
    ax.set_xlabel('Classes de rétinopathie diabétique', fontweight='bold')
    ax.set_title('Distribution finale après augmentation\n(8515 images - parfaitement équilibrées)',
                 fontweight='bold', pad=16)
    ax.set_xticks(x)
    ax.set_xticklabels(CLASSES)

    format_axes(ax)
    ax.set_ylim(0, 1900)
    ax.axhline(y=1703, color='#2c7fb8', linestyle='--', linewidth=1.5, alpha=0.8)
    ax.text(0.02, 0.97, 'Cible atteinte : 1703 images par classe (20 %)', transform=ax.transAxes,
            fontsize=10, verticalalignment='top',
            bbox=dict(boxstyle='round,pad=0.25', facecolor='#f7f7f7', edgecolor='#cccccc'))

    plt.tight_layout()
    plt.savefig('distribution_stage3_augmentation.png', dpi=400, bbox_inches='tight')
    print("✅ Image Étape 3 (Après Augmentation) : distribution_stage3_augmentation.png")
    plt.close()

if __name__ == '__main__':
    setup_style()
    print("🔄 Génération des 3 images du pipeline de prétraitement...\n")
    generate_stage1_raw()
    generate_stage2_cleaning()
    generate_stage3_augmentation()
    print("\n✨ Toutes les images ont été générées avec succès!")
    print("   - distribution_stage1_raw.png")
    print("   - distribution_stage2_cleaning.png")
    print("   - distribution_stage3_augmentation.png")
