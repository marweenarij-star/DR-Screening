"""
HL7/DICOM Integration Module for DR Screening
Handles ORM reception, DICOM parsing, and ORU generation
"""

import io
import json
import logging
from datetime import datetime
from typing import Dict, Optional, Tuple, List
from pathlib import Path
import base64

try:
    import pydicom
    from pydicom.dataset import Dataset, FileDataset
    DICOM_AVAILABLE = True
except ImportError:
    DICOM_AVAILABLE = False
    logging.warning("pydicom not installed - DICOM support disabled")

try:
    import hl7
    HL7_AVAILABLE = True
except ImportError:
    HL7_AVAILABLE = False
    logging.warning("hl7 not installed - HL7 support disabled")

logger = logging.getLogger(__name__)


# ============================================================================
# HL7 MESSAGE HANDLERS
# ============================================================================

class HL7Handler:
    """Handle HL7 ORM/ORU messages"""
    
    @staticmethod
    def parse_orm_message(hl7_message: str) -> Dict:
        """
        Parse HL7 ORM (Order Entry) message
        
        Returns:
            Dict with patient info, exam request details
        """
        if not HL7_AVAILABLE:
            raise RuntimeError("hl7 package not installed")
        
        try:
            segments = hl7.parse(hl7_message)
            
            # Extract segments
            msh = segments[0]  # Message header
            pid = next((s for s in segments if s[0] == 'PID'), None)  # Patient info
            obr = next((s for s in segments if s[0] == 'OBR'), None)  # Order
            
            if not pid or not obr:
                raise ValueError("Missing PID or OBR segment in ORM")
            
            parsed_data = {
                'message_type': msh[9][0],
                'timestamp': HL7Handler._parse_hl7_timestamp(msh[7]),
                'patient': {
                    'id': pid[3][0][0] if len(pid) > 3 else None,
                    'name': pid[5][0] if len(pid) > 5 else None,
                    'birth_date': pid[7] if len(pid) > 7 else None,
                    'gender': pid[8] if len(pid) > 8 else None,
                },
                'exam': {
                    'accession_number': obr[3] if len(obr) > 3 else None,
                    'exam_code': obr[4][0] if len(obr) > 4 else None,
                    'exam_name': obr[4][1] if len(obr) > 4 and len(obr[4]) > 1 else None,
                    'priority': obr[5] if len(obr) > 5 else 'R',
                    'modality': obr[6] if len(obr) > 6 else 'RF',
                    'requested_datetime': HL7Handler._parse_hl7_timestamp(obr[6]) if len(obr) > 6 else None,
                }
            }
            
            logger.info(f"ORM parsed: Patient={parsed_data['patient']['id']}, Accession={parsed_data['exam']['accession_number']}")
            return parsed_data
            
        except Exception as e:
            logger.error(f"Failed to parse ORM message: {e}")
            raise
    
    @staticmethod
    def create_oru_message(exam_data: Dict, ai_results: Dict, doctor_notes: str = None) -> str:
        """
        Create HL7 ORU (Observation Result) message
        
        Args:
            exam_data: Original exam data (from ORM or database)
            ai_results: Dict with 'grade', 'confidence', 'gradcam_path'
            doctor_notes: Optional doctor validation notes
        
        Returns:
            HL7 formatted ORU message
        """
        if not HL7_AVAILABLE:
            raise RuntimeError("hl7 package not installed")
        
        try:
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            
            # ORU message structure
            msh = f"MSH|^~\\&|DR_SCREENING|CENTER-001|RIS|HOSPITAL|{timestamp}||ORU^R01|MSG-{timestamp}|P|2.5|||"
            
            pid_line = (
                f"PID|||{exam_data['patient']['id']}^^^HOSPITAL||"
                f"{exam_data['patient']['name']}||"
                f"{exam_data['patient'].get('birth_date', '')}|"
                f"{exam_data['patient'].get('gender', '')}|||"
            )
            
            obr_line = (
                f"OBR|1|{exam_data['exam'].get('accession_number', 'ACC-001')}|"
                f"{exam_data['exam'].get('study_uid', '1.2.3.4.5.6.7')}|"
                f"RF^RETINAL FUNDUS SCREENING|||{timestamp}|{timestamp}||U||||{timestamp}|"
            )
            
            # OBX segments (observations)
            obx_segments = []
            
            # OBX 1: DR Grade
            obx_segments.append(
                f"OBX|1|NM|DR_GRADE^Diabetic Retinopathy Grade||{ai_results['grade']}||0-4|N||||F|"
            )
            
            # OBX 2: Confidence
            obx_segments.append(
                f"OBX|2|NM|AI_CONFIDENCE^AI Confidence Score||{ai_results['confidence']*100:.1f}||0-100|N||||F|"
            )
            
            # OBX 3: Clinical Notes
            notes = doctor_notes or f"AI-assisted analysis: Grade {ai_results['grade']}, Confidence {ai_results['confidence']*100:.1f}%"
            obx_segments.append(
                f"OBX|3|TX|CLINICAL_NOTES^Clinical Notes||{notes}||||||F|"
            )
            
            # OBX 4: Grad-CAM (if available)
            if ai_results.get('gradcam_path'):
                try:
                    with open(ai_results['gradcam_path'], 'rb') as f:
                        gradcam_b64 = base64.b64encode(f.read()).decode('utf-8')
                    obx_segments.append(
                        f"OBX|4|TX|GRADCAM_IMAGE^Grad-CAM Visualization||{gradcam_b64[:100]}...||||||F|"
                    )
                except:
                    logger.warning(f"Could not read Grad-CAM: {ai_results.get('gradcam_path')}")
            
            # OBX 5: Validation timestamp
            obx_segments.append(
                f"OBX|5|DT|VALIDATION_DATE^Validation Date||{timestamp}||||||F|"
            )
            
            # Combine all segments
            oru_message = "\r".join([msh, pid_line, obr_line] + obx_segments)
            
            logger.info(f"ORU message created for patient {exam_data['patient']['id']}")
            return oru_message
            
        except Exception as e:
            logger.error(f"Failed to create ORU message: {e}")
            raise
    
    @staticmethod
    def _parse_hl7_timestamp(ts_str: str) -> datetime:
        """Parse HL7 timestamp format (YYYYMMDDHHmmss)"""
        if not ts_str or len(ts_str) < 8:
            return datetime.now()
        try:
            return datetime.strptime(ts_str[:14], '%Y%m%d%H%M%S')
        except:
            return datetime.now()


# ============================================================================
# DICOM HANDLERS
# ============================================================================

class DICOMHandler:
    """Handle DICOM file operations"""
    
    @staticmethod
    def parse_dicom_file(file_path: str) -> Tuple[Dict, bytes]:
        """
        Parse DICOM file and extract pixel data
        
        Args:
            file_path: Path to .dcm file
        
        Returns:
            Tuple of (tags_dict, pixel_bytes)
        """
        if not DICOM_AVAILABLE:
            raise RuntimeError("pydicom not installed")
        
        try:
            ds = pydicom.dcmread(file_path)
            
            # Extract key tags
            tags = {
                'patient_id': str(ds.PatientID) if hasattr(ds, 'PatientID') else None,
                'patient_name': str(ds.PatientName) if hasattr(ds, 'PatientName') else None,
                'patient_birth_date': str(ds.PatientBirthDate) if hasattr(ds, 'PatientBirthDate') else None,
                'study_instance_uid': str(ds.StudyInstanceUID) if hasattr(ds, 'StudyInstanceUID') else None,
                'series_instance_uid': str(ds.SeriesInstanceUID) if hasattr(ds, 'SeriesInstanceUID') else None,
                'sop_instance_uid': str(ds.SOPInstanceUID) if hasattr(ds, 'SOPInstanceUID') else None,
                'study_date': str(ds.StudyDate) if hasattr(ds, 'StudyDate') else None,
                'study_time': str(ds.StudyTime) if hasattr(ds, 'StudyTime') else None,
                'modality': str(ds.Modality) if hasattr(ds, 'Modality') else 'RF',
                'manufacturer': str(ds.Manufacturer) if hasattr(ds, 'Manufacturer') else None,
            }
            
            # Extract and normalize pixel data
            if hasattr(ds, 'pixel_array'):
                pixel_array = ds.pixel_array
                
                # Normalize to RGB
                if len(pixel_array.shape) == 2:
                    # Grayscale → RGB
                    import numpy as np
                    rgb_array = np.stack([pixel_array] * 3, axis=-1)
                else:
                    rgb_array = pixel_array
                
                # Convert to bytes (PIL-compatible)
                from PIL import Image
                img = Image.fromarray(rgb_array.astype('uint8'))
                img_bytes = io.BytesIO()
                img.save(img_bytes, format='PNG')
                pixel_bytes = img_bytes.getvalue()
            else:
                pixel_bytes = None
            
            logger.info(f"DICOM parsed: PatientID={tags['patient_id']}, StudyUID={tags['study_instance_uid']}")
            return tags, pixel_bytes
            
        except Exception as e:
            logger.error(f"Failed to parse DICOM: {e}")
            raise
    
    @staticmethod
    def create_dicom_file(
        pixel_array,
        patient_id: str,
        patient_name: str,
        study_uid: str,
        series_uid: str,
        output_path: str,
        metadata: Dict = None
    ) -> str:
        """
        Create DICOM file from image + metadata
        
        Args:
            pixel_array: numpy array of image
            patient_id: Patient ID
            patient_name: Patient name
            study_uid: Study Instance UID
            series_uid: Series Instance UID
            output_path: Output file path
            metadata: Additional metadata dict
        
        Returns:
            Path to created DICOM file
        """
        if not DICOM_AVAILABLE:
            raise RuntimeError("pydicom not installed")
        
        try:
            import numpy as np
            import uuid
            
            # Ensure pixel_array is correct format
            if len(pixel_array.shape) == 3 and pixel_array.shape[2] == 3:
                # RGB → Grayscale for DICOM
                from PIL import Image
                img = Image.fromarray(pixel_array.astype('uint8'), mode='RGB')
                gray_img = img.convert('L')
                pixel_array = np.array(gray_img)
            
            # Create DICOM dataset
            file_meta = Dataset()
            file_meta.MediaStorageSOPClassUID = '1.2.840.10008.5.1.4.1.1.66.4'  # Retinal image
            file_meta.MediaStorageSOPInstanceUID = str(uuid.uuid4())
            file_meta.ImplementationClassUID = '1.2.3.4'
            
            ds = FileDataset(
                output_path,
                {},
                file_meta=file_meta,
                preamble=b"\0" * 128
            )
            
            # Patient tags
            ds.PatientID = patient_id
            ds.PatientName = patient_name
            ds.PatientBirthDate = metadata.get('birth_date', '') if metadata else ''
            ds.PatientSex = metadata.get('gender', '') if metadata else ''
            
            # Study tags
            ds.StudyInstanceUID = study_uid
            ds.SeriesInstanceUID = series_uid
            ds.SOPInstanceUID = file_meta.MediaStorageSOPInstanceUID
            ds.SOPClassUID = file_meta.MediaStorageSOPClassUID
            
            # Image tags
            ds.StudyDate = datetime.now().strftime('%Y%m%d')
            ds.StudyTime = datetime.now().strftime('%H%M%S')
            ds.Modality = 'RF'  # Retinal Fundus
            ds.SeriesDescription = 'Retinal Fundus Screening'
            ds.StudyDescription = 'Diabetic Retinopathy Screening'
            
            # Pixel data
            ds.SamplesPerPixel = 1
            ds.PhotometricInterpretation = 'MONOCHROME2'
            ds.Rows, ds.Columns = pixel_array.shape
            ds.BitsAllocated = 16
            ds.BitsStored = 16
            ds.HighBit = 15
            ds.PixelRepresentation = 0
            ds.PixelData = pixel_array.tobytes()
            
            # Save
            ds.save_as(output_path)
            logger.info(f"DICOM file created: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Failed to create DICOM file: {e}")
            raise


# ============================================================================
# PACS OPERATIONS (Stub - requires pynetdicom in production)
# ============================================================================

class PACSClient:
    """
    PACS client for DICOM operations
    Requires: pip install pynetdicom
    """
    
    def __init__(self, pacs_host: str, pacs_port: int = 104, ae_title: str = 'DR_SCREENING'):
        self.pacs_host = pacs_host
        self.pacs_port = pacs_port
        self.ae_title = ae_title
        self.pynetdicom_available = False
        
        try:
            from pynetdicom import AE
            self.AE = AE
            self.pynetdicom_available = True
        except ImportError:
            logger.warning("pynetdicom not installed - PACS network operations unavailable")
    
    def query_mwl(self, study_date: str = None) -> List[Dict]:
        """
        Query PACS for Modality Worklist (C-FIND)
        
        Args:
            study_date: Format YYYYMMDD, defaults to today
        
        Returns:
            List of worklist items
        """
        if not self.pynetdicom_available:
            logger.warning("PACS query unavailable (pynetdicom not installed)")
            return []
        
        try:
            from pydicom.dataset import Dataset
            
            ae = self.AE()
            ae.add_requested_context('1.2.840.10008.5.1.4.31.1')  # MWL
            
            assoc = ae.associate(self.pacs_host, self.pacs_port)
            
            if not assoc.is_established:
                logger.error(f"Failed to establish association with PACS")
                return []
            
            # Build query
            ds = Dataset()
            ds.PatientName = '*'
            ds.PatientID = '*'
            ds.StudyDate = study_date or datetime.now().strftime('%Y%m%d')
            ds.Modality = 'RF'
            
            # Send C-FIND
            mwl_list = []
            responses = assoc.send_c_find(ds)
            
            for (status, identifier) in responses:
                if status.Status in (0xFF00, 0xFF01):  # Pending
                    mwl_list.append({
                        'patient_id': str(identifier.PatientID),
                        'patient_name': str(identifier.PatientName),
                        'study_uid': str(identifier.StudyInstanceUID),
                        'accession_number': str(identifier.AccessionNumber) if hasattr(identifier, 'AccessionNumber') else None,
                    })
            
            assoc.release()
            logger.info(f"MWL query returned {len(mwl_list)} items")
            return mwl_list
            
        except Exception as e:
            logger.error(f"MWL query failed: {e}")
            return []
    
    def store_dicom(self, dicom_file_path: str) -> bool:
        """
        Store DICOM file in PACS (C-STORE)
        
        Args:
            dicom_file_path: Path to .dcm file
        
        Returns:
            True if successful
        """
        if not self.pynetdicom_available:
            logger.warning("PACS store unavailable (pynetdicom not installed)")
            return False
        
        try:
            ae = self.AE()
            ae.add_requested_context('1.2.840.10008.5.1.4.1.1.66.4')  # Retinal image
            
            ds = pydicom.dcmread(dicom_file_path)
            assoc = ae.associate(self.pacs_host, self.pacs_port)
            
            if not assoc.is_established:
                return False
            
            status = assoc.send_c_store(ds)
            assoc.release()
            
            success = status.Status == 0x0000
            if success:
                logger.info(f"DICOM stored in PACS: {dicom_file_path}")
            else:
                logger.error(f"DICOM store failed: {status}")
            
            return success
            
        except Exception as e:
            logger.error(f"C-STORE failed: {e}")
            return False


# ============================================================================
# INTEGRATION WORKFLOW
# ============================================================================

class ExamWorkflow:
    """High-level exam workflow coordinator"""
    
    def __init__(self, pacs_config: Dict = None):
        self.hl7_handler = HL7Handler()
        self.dicom_handler = DICOMHandler()
        self.pacs_client = PACSClient(
            pacs_config['host'],
            pacs_config.get('port', 104)
        ) if pacs_config else None
    
    def process_orm_request(self, hl7_orm_message: str, output_dir: str) -> Dict:
        """
        Process incoming HL7 ORM message
        Returns exam request ready for worklist
        """
        parsed = self.hl7_handler.parse_orm_message(hl7_orm_message)
        parsed['status'] = 'PENDING'
        parsed['created_at'] = datetime.now().isoformat()
        return parsed
    
    def process_exam_result(self, exam_id: str, ai_results: Dict, doctor_notes: str = None) -> str:
        """
        Generate HL7 ORU report message
        """
        # In production: fetch exam_data from database
        exam_data = {
            'patient': {'id': 'PAT-001', 'name': 'TEST^PATIENT', 'gender': 'M'},
            'exam': {'accession_number': 'ACC-001', 'study_uid': '1.2.3.4.5'},
        }
        
        oru_message = self.hl7_handler.create_oru_message(exam_data, ai_results, doctor_notes)
        return oru_message


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    
    print("HL7/DICOM Integration Module for DR Screening")
    print(f"DICOM available: {DICOM_AVAILABLE}")
    print(f"HL7 available: {HL7_AVAILABLE}")
