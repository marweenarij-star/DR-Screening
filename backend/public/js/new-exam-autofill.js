// Auto-select patient and doctor in new-exam.html if URL params are present
(function() {
    function getUrlParam(name) {
        const url = new URL(window.location.href);
        return url.searchParams.get(name);
    }

    document.addEventListener('DOMContentLoaded', function() {
        const patientId = getUrlParam('patient_id');
        const doctorId = getUrlParam('doctor_id');

        if (patientId) {
            const patientSelect = document.getElementById('patient_id');
            if (patientSelect) {
                // Wait for options to be loaded if needed
                const trySelect = () => {
                    const option = patientSelect.querySelector(`option[value="${patientId}"]`);
                    if (option) {
                        patientSelect.value = patientId;
                    } else {
                        setTimeout(trySelect, 100);
                    }
                };
                trySelect();
            }
        }
        if (doctorId) {
            const doctorSelect = document.getElementById('doctor_id');
            if (doctorSelect) {
                const trySelect = () => {
                    const option = doctorSelect.querySelector(`option[value="${doctorId}"]`);
                    if (option) {
                        doctorSelect.value = doctorId;
                    } else {
                        setTimeout(trySelect, 100);
                    }
                };
                trySelect();
            }
        }
    });
})();
