#!/usr/bin/env node

/**
 * OpenClaw 자동 설정 스크립트
 * 
 * 사용법:
 *   node setup-openclaw.js
 *   # 또는 API Key를 환경변수로 전달
 *   OPENCLAW_API_KEY="your-key" node setup-openclaw.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// 설정값
const CONFIG = {
  providerName: 'custom-claude',
  baseUrl: 'https://ai.9eon.com',
  apiType: 'anthropic-messages',
  authType: 'api-key',
  primaryModel: 'claude-opus-4-7',
  models: [
    {
      id: 'claude-opus-4-7',
      name: 'Claude Opus 4.7',
      input: ['text', 'image'],
      contextWindow: 200000,
      maxTokens: 8192
    },
    {
      id: 'claude-sonnet-4-6',
      name: 'Claude Sonnet 4.6',
      input: ['text', 'image'],
      contextWindow: 200000,
      maxTokens: 8192
    },
    {
      id: 'claude-haiku-4-5',
      name: 'Claude Haiku 4.5',
      input: ['text', 'image'],
      contextWindow: 200000,
      maxTokens: 8192
    }
  ]
};

// 홈 디렉토리 가져오기
function getHomeDir() {
  return os.homedir();
}

// OpenClaw 설정 디렉토리 가져오기
function getOpenclawDir() {
  return process.env.OPENCLAW_STATE_DIR || path.join(getHomeDir(), '.openclaw');
}

// 설정 파일 경로 가져오기
function getConfigPath() {
  return path.join(getOpenclawDir(), 'openclaw.json');
}

// 랜덤 토큰 생성
function generateToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 40; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

// API Key 입력받기
async function promptApiKey() {
  // 환경변수에서 먼저 확인
  const envKey = process.env.OPENCLAW_API_KEY;
  if (envKey) {
    console.log('✓ 환경변수 OPENCLAW_API_KEY에서 API Key를 가져왔습니다.');
    return envKey;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('API Key를 입력하세요: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// 기존 설정 읽기
function readExistingConfig(configPath) {
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('⚠ 기존 설정 파일 읽기 실패:', error.message);
  }
  return null;
}

// 설정 생성
function createConfig(apiKey, existingConfig = null) {
  const gatewayToken = generateToken();
  const openclawDir = getOpenclawDir();
  const workspaceDir = path.join(openclawDir, 'workspace');

  // 기본 설정 구조
  const config = existingConfig || {
    agents: {
      defaults: {
        workspace: workspaceDir,
        model: { primary: '', fallbacks: [] },
        models: {},
        maxConcurrent: 4,
        subagents: { maxConcurrent: 8 }
      },
      list: []
    },
    gateway: {
      mode: 'local',
      auth: { mode: 'token', token: gatewayToken },
      port: 18789,
      bind: 'loopback',
      tailscale: { mode: 'off', resetOnExit: false },
      controlUi: { allowInsecureAuth: true },
      nodes: { denyCommands: [] },
      remote: { token: gatewayToken }
    },
    session: { dmScope: 'per-channel-peer' },
    tools: {
      profile: 'coding',
      media: { image: { models: [] } }
    },
    channels: {},
    hooks: {
      internal: { enabled: true, entries: {} }
    },
    wizard: {},
    meta: {},
    models: { mode: 'merge', providers: {} },
    auth: { profiles: {} }
  };

  // 기존 설정이 있으면 일부 값 유지
  if (existingConfig) {
    if (existingConfig.gateway?.auth?.token) {
      config.gateway.auth.token = existingConfig.gateway.auth.token;
      config.gateway.remote.token = existingConfig.gateway.auth.token;
    }
    if (existingConfig.agents?.defaults?.workspace) {
      config.agents.defaults.workspace = existingConfig.agents.defaults.workspace;
    }
  }

  // Models providers 설정
  config.models.providers[CONFIG.providerName] = {
    baseUrl: CONFIG.baseUrl,
    auth: CONFIG.authType,
    api: CONFIG.apiType,
    headers: {},
    authHeader: false,
    apiKey: apiKey,
    models: CONFIG.models
  };

  // Auth profiles 설정
  config.auth.profiles[`${CONFIG.providerName}:default`] = {
    provider: CONFIG.providerName,
    mode: 'api_key'
  };

  // Agents defaults 설정
  config.agents.defaults.model.primary = `${CONFIG.providerName}/${CONFIG.primaryModel}`;
  config.agents.defaults.model.fallbacks = CONFIG.models
    .filter(m => m.id !== CONFIG.primaryModel)
    .map(m => `${CONFIG.providerName}/${m.id}`);

  // Models 등록
  CONFIG.models.forEach(model => {
    const modelKey = `${CONFIG.providerName}/${model.id}`;
    config.agents.defaults.models[modelKey] = { alias: CONFIG.providerName };
  });

  // Image model 설정
  config.agents.defaults.imageModel = `${CONFIG.providerName}/${CONFIG.primaryModel}`;

  // Tools media image models 설정
  config.tools.media.image.models = CONFIG.models.map(model => ({
    provider: CONFIG.providerName,
    model: model.id,
    capabilities: ['image']
  }));

  // Agents list 설정
  const mainAgent = {
    id: 'main',
    default: true,
    name: CONFIG.providerName,
    model: {
      primary: `${CONFIG.providerName}/${CONFIG.primaryModel}`,
      fallbacks: CONFIG.models
        .filter(m => m.id !== CONFIG.primaryModel)
        .map(m => `${CONFIG.providerName}/${m.id}`)
    }
  };

  const existingMainIndex = config.agents.list.findIndex(a => a.id === 'main');
  if (existingMainIndex >= 0) {
    config.agents.list[existingMainIndex] = mainAgent;
  } else {
    config.agents.list.push(mainAgent);
  }

  return config;
}

// 설정 저장
function saveConfig(config, configPath) {
  const configDir = path.dirname(configPath);
  
  // 디렉토리 생성
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // 설정 파일 저장
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

// 메인 함수
async function main() {
  console.log('========================================');
  console.log('  OpenClaw 자동 설정 스크립트');
  console.log('========================================\n');

  console.log(`프로바이더: ${CONFIG.providerName}`);
  console.log(`Base URL: ${CONFIG.baseUrl}`);
  console.log(`API 타입: ${CONFIG.apiType}`);
  console.log(`모델: ${CONFIG.models.map(m => m.id).join(', ')}`);
  console.log(`주요 모델: ${CONFIG.primaryModel}\n`);

  const configPath = getConfigPath();
  console.log(`설정 파일 경로: ${configPath}\n`);

  // 기존 설정 확인
  const existingConfig = readExistingConfig(configPath);
  if (existingConfig) {
    console.log('⚠ 기존 설정 파일이 존재합니다.');
    console.log('  기존 설정을 유지하면서 새 프로바이더를 추가합니다.\n');
  }

  // API Key 입력
  const apiKey = await promptApiKey();
  
  if (!apiKey) {
    console.error('\n✗ API Key가 입력되지 않았습니다. 종료합니다.');
    process.exit(1);
  }

  console.log('\n설정을 생성하는 중...');

  // 설정 생성
  const config = createConfig(apiKey, existingConfig);

  // 설정 저장
  saveConfig(config, configPath);

  console.log('\n✓ 설정이 완료되었습니다!');
  console.log(`\n설정 파일: ${configPath}`);
  console.log(`\n등록된 모델:`);
  CONFIG.models.forEach(model => {
    const isPrimary = model.id === CONFIG.primaryModel ? ' (주요)' : '';
    console.log(`  - ${CONFIG.providerName}/${model.id}${isPrimary}`);
  });

  console.log('\n========================================');
  console.log('  다음 단계:');
  console.log('========================================');
  console.log('1. OpenClaw를 재시작하세요:');
  console.log('   openclaw gateway restart');
  console.log('\n2. 설정이 정상적으로 적용되었는지 확인하세요:');
  console.log('   openclaw status');
  console.log('========================================');
}

// 스크립트 실행
main().catch(error => {
  console.error('\n✗ 오류 발생:', error.message);
  process.exit(1);
});
