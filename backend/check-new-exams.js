const db=require('./src/config/database');
(async()=>{
  try{
    const rows=await db.query(`SELECT p.id as patient_id, p.full_name, COUNT(e.id) as total_exams, SUM(CASE WHEN e.is_new_for_doctor=1 THEN 1 ELSE 0 END) as new_exams FROM exams e JOIN patients p ON e.patient_id=p.id WHERE e.doctor_id=? GROUP BY p.id`,[2]);
    console.log(JSON.stringify(rows,null,2));
    process.exit(0);
  }catch(e){console.error(e);process.exit(1)}
})();
