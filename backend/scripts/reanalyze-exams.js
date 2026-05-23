/**
 * Script to re-analyze existing exams and generate Grad-CAM images
 */

const path = require('path');
const fs = require('fs');

// Load environment
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('../src/config/database');
const aiService = require('../src/services/aiService');

async function reanalyzeExams() {
    try {
        console.log('Starting exam re-analysis...');
        
        // Get all exams that need heatmaps
        const exams = await db.query(
            'SELECT id, image_path FROM exams WHERE heatmap_path IS NULL AND image_path IS NOT NULL ORDER BY id DESC LIMIT 10'
        );
        
        console.log(`Found ${exams.length} exams to re-analyze`);
        
        for (const exam of exams) {
            try {
                console.log(`\nProcessing exam ${exam.id}...`);
                
                const fullImagePath = path.join(__dirname, '../', exam.image_path);
                
                if (!fs.existsSync(fullImagePath)) {
                    console.log(`  Image not found: ${fullImagePath}`);
                    continue;
                }
                
                // Get AI prediction
                console.log(`  Getting prediction...`);
                const prediction = await aiService.predict(fullImagePath);
                console.log(`  Prediction: grade=${prediction.grade}, confidence=${prediction.confidence}%`);
                
                // Get Grad-CAM
                console.log(`  Generating Grad-CAM...`);
                let gradcamRelPath = null;
                try {
                    const gradcamBuffer = await aiService.getGradCAM(fullImagePath, prediction.grade);
                    if (gradcamBuffer && gradcamBuffer.length > 0) {
                        const gradcamPath = fullImagePath.replace(/\.[^.]+$/, '_gradcam.png');
                        fs.writeFileSync(gradcamPath, gradcamBuffer);
                        gradcamRelPath = path.relative(path.join(__dirname, '../'), gradcamPath);
                        console.log(`  Grad-CAM saved: ${gradcamRelPath} (${gradcamBuffer.length} bytes)`);
                    } else {
                        console.log(`  No Grad-CAM data received`);
                    }
                } catch (gradcamError) {
                    console.error(`  Grad-CAM error:`, gradcamError.message);
                }
                
                // Update exam
                await db.update('exams', {
                    grade: prediction.grade,
                    confidence: prediction.confidence,
                    heatmap_path: gradcamRelPath
                }, 'id = ?', [exam.id]);
                
                console.log(`  Exam ${exam.id} updated successfully`);
                
            } catch (examError) {
                console.error(`  Error processing exam ${exam.id}:`, examError.message);
            }
        }
        
        console.log('\n\nRe-analysis complete!');
        process.exit(0);
        
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

reanalyzeExams();
