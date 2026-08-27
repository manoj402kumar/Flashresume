const EventSource = require('eventsource');
const es = new EventSource('http://localhost:8000/api/jobs/dummy/stream');
es.addEventListener('result', (e) => {
  console.log("Got result!", e.data);
  es.close();
});
es.addEventListener('status', (e) => {
  console.log("Got status!", e.data);
});
es.onerror = (err) => {
  console.log("Error:", err);
};
