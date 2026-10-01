// D1 batches are transactions: quota and case authorization are checked at
// admission, after the asynchronous upload, instead of relying on old reads.
export const EVIDENCE_ADMISSION = `
INSERT INTO evidence (id,case_id,owner_id,object_key,name,type,size,hash,created_at)
SELECT ?,c.id,c.owner_id,?,?,?,?,?,? FROM cases c
WHERE c.id=? AND c.version=? AND c.status=?
AND ((?=0 AND c.owner_id=? AND c.status IN ('draft','approved','rejected'))
  OR (?=1 AND c.partner_id=? AND c.status='accepted'))
AND (SELECT COUNT(*) FROM evidence WHERE case_id=c.id)<10
AND COALESCE((SELECT SUM(size) FROM evidence WHERE case_id=c.id),0)+?<=20971520`;
export const EVIDENCE_UPDATE = `UPDATE cases
SET version=version+1,approved_version=NULL,status='draft',updated_at=?
WHERE id=? AND EXISTS (SELECT 1 FROM evidence WHERE id=? AND case_id=cases.id)`;
export const RECEIPT_UPDATE = `UPDATE cases SET receipt_key=?,updated_at=?
WHERE id=? AND EXISTS (SELECT 1 FROM evidence WHERE id=? AND case_id=cases.id)`;
