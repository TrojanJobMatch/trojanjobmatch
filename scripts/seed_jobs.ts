// Local development only: inserts a few made-up job postings so the feed has
// something to show. Safe to re-run (it replaces its own rows, source = 'seed').
// Run: npx tsx --env-file=.env.local scripts/seed_jobs.ts
// Then: npx tsx --env-file=.env.local scripts/classify_jobs.ts
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const JOBS: { company: string; role: string; location: string; type: string; jd: string }[] = [
  {
    company: "Northwind Labs", role: "Software Engineering Intern", location: "Los Angeles, CA", type: "Internship",
    jd: "Join our platform team for a 12-week summer internship. You will build REST APIs in Python and FastAPI, write SQL against PostgreSQL, and ship React features with TypeScript. Requirements: pursuing a B.S. or M.S. in Computer Science graduating between December 2027 and June 2028, solid data structures and algorithms, experience with Git. Nice to have: Docker, AWS, CI/CD.",
  },
  {
    company: "Helio AI", role: "Machine Learning Engineer Intern", location: "San Francisco, CA", type: "Internship",
    jd: "Work with our applied ML team training and evaluating deep learning models. You will write PyTorch training code, run experiments, analyze results with pandas and NumPy, and help deploy models. Requirements: M.S. or Ph.D. student in CS or a related field, strong Python, coursework in machine learning, experience with PyTorch or TensorFlow. Nice to have: MLOps tools such as MLflow, computer vision or NLP projects.",
  },
  {
    company: "Corvid Systems", role: "New Grad Software Engineer", location: "Seattle, WA", type: "Full-time",
    jd: "We are hiring new graduates to build distributed systems that serve millions of requests. You will design services in Java or Go, work with Kafka and Redis, and own features from design to production on Kubernetes. Requirements: B.S. or M.S. in Computer Science completed by June 2028, strong fundamentals in algorithms and system design, internship or project experience building backend services. Nice to have: AWS, Terraform, gRPC.",
  },
  {
    company: "Lumen Health", role: "Data Science Intern", location: "Remote", type: "Internship",
    jd: "Help our analytics team turn clinical data into insight. You will write SQL, build statistical models in Python with scikit-learn, run A/B tests, and present findings in Tableau dashboards. Requirements: pursuing a degree in Statistics, Data Science, Computer Science or similar; strong SQL and Python; a solid grounding in statistics and hypothesis testing. Nice to have: experience with Snowflake or BigQuery and good communication skills.",
  },
  {
    company: "Atlas Robotics", role: "Robotics Perception Intern", location: "Pittsburgh, PA", type: "Internship",
    jd: "Build perception systems for warehouse robots. You will develop computer vision pipelines in C++ and Python with OpenCV and PyTorch, work with lidar data, and test on real hardware running Linux. Requirements: M.S. or Ph.D. student in Robotics, CS or EE; strong C++; coursework or projects in computer vision or SLAM. Nice to have: ROS, embedded systems experience.",
  },
  {
    company: "Quill", role: "GenAI Engineer, New Grad", location: "New York, NY", type: "Full-time",
    jd: "Build LLM-powered product features end to end. You will design retrieval-augmented generation pipelines, build AI agents with tool use, evaluate prompts, and ship them behind TypeScript and Next.js front ends with a Python backend. Requirements: B.S. or M.S. in Computer Science, hands-on projects with LLMs, RAG or agent frameworks such as LangChain, strong Python and TypeScript. Nice to have: PostgreSQL, vector databases, Docker.",
  },
  {
    company: "Stackline Cloud", role: "Site Reliability Engineer Intern", location: "Austin, TX", type: "Internship",
    jd: "Keep our cloud platform fast and reliable. You will automate infrastructure with Terraform, operate Kubernetes clusters on AWS, improve CI/CD pipelines with GitHub Actions, and write tooling in Python and Bash. Requirements: pursuing a degree in Computer Science or similar, comfortable with Linux and networking basics, scripting experience. Nice to have: Docker, monitoring tools, distributed systems coursework.",
  },
  {
    company: "Sentry Gate", role: "Security Engineer, Early Career", location: "Los Angeles, CA", type: "Full-time",
    jd: "Join our application security team. You will review code for vulnerabilities, run penetration testing against web services, build detection tooling in Python, and work with engineers to fix issues following OWASP guidance. Requirements: B.S. in Computer Science or Cybersecurity, understanding of networking and web security, programming experience in Python or Go. Nice to have: cloud security on AWS, CTF experience.",
  },
  {
    company: "Brightpath", role: "Product Manager Intern", location: "San Jose, CA", type: "Internship",
    jd: "Work with engineering and design to ship features for our learning platform. You will write PRDs, define a roadmap for one product area, run user research and usability testing, and analyze usage data with SQL and Excel. Requirements: pursuing a B.S., M.S. or MBA; strong communication skills; some technical background. Nice to have: experience with Agile teams, Figma and A/B testing.",
  },
  {
    company: "Pixel Foundry", role: "Frontend Engineer Intern", location: "Remote", type: "Internship",
    jd: "Build polished, accessible web interfaces. You will develop React and Next.js features in TypeScript, write HTML and CSS that works on every screen size, add unit tests with Jest, and collaborate with designers in Figma. Requirements: pursuing a degree in Computer Science or similar, strong JavaScript, at least one shipped web project. Nice to have: GraphQL, Node.js, testing with Cypress.",
  },
  {
    company: "Ridgeline Data", role: "Data Engineer, New Grad", location: "Denver, CO", type: "Full-time",
    jd: "Build the pipelines that power analytics across the company. You will write ETL jobs in Python and SQL, orchestrate them with Airflow, model data with dbt in Snowflake, and process large datasets with Spark. Requirements: B.S. or M.S. in Computer Science or a related field, strong SQL, Python programming experience, understanding of data modeling. Nice to have: Kafka, AWS, Docker.",
  },
  {
    company: "Corvid Systems", role: "Senior Staff Software Engineer", location: "Seattle, WA", type: "Full-time",
    jd: "Lead the architecture of our storage platform. You will set technical direction for several teams, design distributed systems at very large scale, and mentor senior engineers. Requirements: 10+ years of experience building backend systems, deep expertise in distributed systems and system design, a track record of leading large projects. Languages: Java, Go, C++.",
  },
];

async function main() {
  await sql`delete from jobs where source = 'seed'`;
  for (const j of JOBS) {
    await sql`
      insert into jobs (company, role, location, type, jd_text, apply_url, source, posted_date)
      values (${j.company}, ${j.role}, ${j.location}, ${j.type}, ${j.jd}, ${"https://example.com/jobs"}, 'seed', current_date)
    `;
  }
  console.log(`Inserted ${JOBS.length} sample jobs.`);
}
main();
