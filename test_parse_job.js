const EventSource = require('eventsource');
const fs = require('fs');

async function run() {
  const fileData = fs.readFileSync("public/reference_Resume.pdf");
  const blob = new Blob([fileData], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('file', blob, 'test.pdf');
  
  const resp = await fetch("http://localhost:8000/api/parse", {
    method: "POST",
    body: formData
  });
  const data = await resp.json();
  const jobId = data.job_id;
  console.log("Job ID:", jobId);
  
  const es = new EventSource(`http://localhost:8000/api/jobs/${jobId}/stream`);
  es.addEventListener('result', (e) => {
    console.log("Got result!");
    es.close();
  });
  es.addEventListener('status', (e) => {
    console.log("Got status!", e.data);
  });
  es.onerror = (err) => {
    console.log("Error:", err);
  };
}
run();
