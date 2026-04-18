# OpenClaw Setup

OpenClaw 자동 설정 스크립트 - custom-claude 프로바이더

## 사용법

### npx로 실행
```bash
npx github:geongoing/openclaw
```

### 또는 로컬에서 실행
```bash
git clone https://github.com/geongoing/openclaw.git
cd openclaw
node bin/openclaw-setup.js
```

## 설정 내용

- **프로바이더**: custom-claude
- **Base URL**: https://ai.9eon.com
- **API 타입**: anthropic-messages
- **모델**:
  - claude-opus-4-7 (주요)
  - claude-sonnet-4-6
  - claude-haiku-4-5

## API Key 입력 방법

### 방법 1: 대화형 입력
```bash
npx github:geongoing/openclaw
# 프롬프트에 API Key 입력
```

### 방법 2: 환경변수로 전달
```bash
OPENCLAW_API_KEY="sk-..." npx github:geongoing/openclaw
```

## 설치 후

```bash
# OpenClaw 재시작
openclaw gateway restart

# 상태 확인
openclaw status
```
