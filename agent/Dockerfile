FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY vordr_agent ./vordr_agent

ENV PYTHONUNBUFFERED=1

CMD ["python", "-m", "vordr_agent.main"]
