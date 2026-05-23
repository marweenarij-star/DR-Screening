# Short runner to train EfficientNet-B3 for a quick experiment
# Import the local module directly when running from the training/ folder
import train_efficientnet as te

# Quick experiment settings
te.CONFIG['num_epochs'] = 3
te.CONFIG['fine_tune_epochs'] = 2
te.CONFIG['batch_size'] = 8
te.CONFIG['patience'] = 3

if __name__ == '__main__':
    print('Running short EfficientNet-B3 experiment with CONFIG:', {k: te.CONFIG[k] for k in ['num_epochs','fine_tune_epochs','batch_size','patience','image_size']})
    te.train()
