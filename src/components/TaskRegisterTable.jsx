import { Link } from 'react-router-dom';

function fmtDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// The Urdu task register: سیریل نمبر / موضوع / ڈیڈ لائن / تکمیل کی تاریخ / وضاحت
// — a plain, bordered log table rather than the card list used elsewhere,
// per the layout the user specified.
export default function TaskRegisterTable({ tasks }) {
  if (tasks.length === 0) {
    return <div className="empty-state">کوئی ٹاسک موجود نہیں۔</div>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table" dir="rtl">
        <thead>
          <tr>
            <th className="col-serial">سیریل نمبر</th>
            <th>موضوع</th>
            <th>ڈیڈ لائن</th>
            <th>تکمیل کی تاریخ</th>
            <th>وضاحت</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t, i) => (
            <tr key={t.id}>
              <td className="col-serial">{i + 1}</td>
              <td>
                <Link to={`/task/${t.id}`}>{t.title}</Link>
              </td>
              <td>{fmtDate(t.deadline)}</td>
              <td>{t.status === 'approved' ? fmtDate(t.updated_at) : '—'}</td>
              <td>{t.description || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
