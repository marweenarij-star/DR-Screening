require('dotenv').config({ path: './.env' });
const { supabase } = require('./src/services/supabaseClient');

(async () => {
  try {
    // Find a doctor
    const { data: doctors, error: docErr } = await supabase.from('users').select('id,center_id').eq('role','doctor').limit(1);
    if (docErr) return console.error('doctor query error:', docErr.message || docErr);
    if (!doctors || doctors.length === 0) return console.error('No doctor found in DB to link the exam to.');
    const doctor = doctors[0];

    // Find a patient in the same center
    const { data: patients, error: patErr } = await supabase.from('patients').select('id').eq('center_id', doctor.center_id).limit(1);
    if (patErr) return console.error('patient query error:', patErr.message || patErr);
    if (!patients || patients.length === 0) return console.error('No patient found in DB to link the exam to.');
    const patient = patients[0];

    // Build test exam (must satisfy FK constraints)
    const exam = {
      center_id: doctor.center_id,
      patient_id: patient.id,
      doctor_id: doctor.id,
      image_path: 'tests/test_image.jpg',
      grade: 0,
      confidence: 0,
      eye: 'unknown',
      notes: 'Test insert from test_supabase_insert_exam.js'
    };

    const { data, error } = await supabase.from('exams').insert([exam]);
    if (error) {
      console.error('Insert error:', error);
    } else {
      console.log('Insert success:', data);
    }
  } catch (err) {
    console.error('Unexpected error:', err && err.message ? err.message : err);
  }
})();
