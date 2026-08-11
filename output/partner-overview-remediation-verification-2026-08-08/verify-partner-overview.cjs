const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const repoRoot = path.resolve(__dirname, '..', '..');
const baseUrl = 'http://localhost:3101';

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return Object.fromEntries(
    fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return null;
        const separator = trimmed.indexOf('=');
        if (separator < 1) return null;
        const key = trimmed.slice(0, separator).trim();
        let value = trimmed.slice(separator + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        return [key, value];
      })
      .filter(Boolean),
  );
}

const env = {
  ...parseEnvFile(path.join(repoRoot, '.env')),
  ...parseEnvFile(path.join(repoRoot, 'apps', 'admin_web', '.env.local')),
};

async function login(page) {
  if (!env.ADMIN_WEB_LOGIN_EMAIL || !env.ADMIN_WEB_LOGIN_PASSWORD) {
    throw new Error('Local admin login configuration is unavailable.');
  }

  await page.goto(`${baseUrl}/login?redirectTo=%2Fpartners%2Foverview`, {
    waitUntil: 'networkidle',
  });
  await page.getByLabel('Email').fill(env.ADMIN_WEB_LOGIN_EMAIL);
  await page.getByLabel('Password').fill(env.ADMIN_WEB_LOGIN_PASSWORD);
  await Promise.all([
    page.waitForURL('**/partners/overview'),
    page.getByRole('button', { name: 'Sign in' }).click(),
  ]);
}

async function inspectLayout(page, label) {
  return page.evaluate((stateLabel) => {
    const rect = (element) => {
      const bounds = element.getBoundingClientRect();
      return {
        bottom: Math.round(bounds.bottom),
        height: Math.round(bounds.height),
        left: Math.round(bounds.left),
        right: Math.round(bounds.right),
        top: Math.round(bounds.top),
        width: Math.round(bounds.width),
      };
    };
    const overlaps = (a, b) =>
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const uniqueTops = (elements) => [
      ...new Set(elements.map((element) => Math.round(element.getBoundingClientRect().top))),
    ];
    const visualRowCount = (elements) => {
      const bands = [];
      elements
        .map(rect)
        .sort((a, b) => a.top - b.top)
        .forEach((item) => {
          const band = bands.find((candidate) => item.top < candidate.bottom && item.bottom > candidate.top);
          if (band) {
            band.top = Math.min(band.top, item.top);
            band.bottom = Math.max(band.bottom, item.bottom);
          } else {
            bands.push({ top: item.top, bottom: item.bottom });
          }
        });
      return bands.length;
    };
    const financeStrips = [...document.querySelectorAll('.partner-overview-mini-kpis')];
    const financeOverlapPairs = [];

    financeStrips.forEach((strip, stripIndex) => {
      const cards = [...strip.children].map(rect);
      cards.forEach((card, index) => {
        cards.slice(index + 1).forEach((other, offset) => {
          if (overlaps(card, other)) {
            financeOverlapPairs.push([stripIndex, index, index + offset + 1]);
          }
        });
      });
    });

    const selection = document.querySelector('.partner-overview-selection-table');
    const area = document.querySelector('.partner-overview-area-table');
    const filterChildren = [...document.querySelectorAll('.partner-overview-filter-grid > *')].filter(
      (element) => getComputedStyle(element).display !== 'none',
    );
    const actionLinks = [
      ...document.querySelectorAll(
        'a.partner-overview-priority-card, .partner-overview-priority-card a',
      ),
    ].map(
      (link) => ({ href: link.getAttribute('href'), text: link.textContent?.trim() }),
    );
    const pageText = document.body.innerText;

    return {
      actionLinks,
      area: area ? rect(area) : null,
      areaHeaders: area
        ? [...area.querySelectorAll('thead th')].map((cell) => cell.textContent?.trim())
        : [],
      currentUrl: location.href,
      financeOverlapPairs,
      filterRowCount: visualRowCount(filterChildren),
      filterRows: uniqueTops(filterChildren),
      heading: document.querySelector('h1')?.textContent?.trim() ?? null,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      label: stateLabel,
      pageClientWidth: document.documentElement.clientWidth,
      pageScrollWidth: document.documentElement.scrollWidth,
      selection: selection ? rect(selection) : null,
      selectionHeaders: selection
        ? [...selection.querySelectorAll('thead th')].map((cell) => cell.textContent?.trim())
        : [],
      textContracts: {
        appTelemetryCoverage: pageText.includes('App telemetry coverage'),
        bookableNow: pageText.includes('Bookable now'),
        currentReadinessSnapshot: pageText.includes('Current readiness snapshot'),
        negativeWalletVisibilityBlocker: pageText.includes('Bank approval missing'),
        nonCompleted: pageText.includes('Non-completed'),
        onlineAvailable: pageText.includes('Online available'),
        partnerOperations: pageText.includes('Partner Operations'),
        visibleInCustomerApp: pageText.includes('Visible in customer app'),
      },
      viewport: { height: innerHeight, width: innerWidth },
    };
  }, label);
}

async function captureState(page, report, { fileName, label, url, viewport, fullPage = false }) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}${url}`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Partner Operations' }).waitFor();
  report.states.push(await inspectLayout(page, label));
  await page.screenshot({
    fullPage,
    path: path.join(__dirname, fileName),
  });
}

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const context = await browser.newContext({ colorScheme: 'light' });
  const page = await context.newPage();
  const consoleMessages = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleMessages.push({ text: message.text(), type: message.type(), url: page.url() });
    }
  });

  const report = {
    capturedAt: new Date().toISOString(),
    consoleMessages,
    drilldown: null,
    states: [],
  };

  try {
    await login(page);
    await captureState(page, report, {
      fileName: '01-today-1692x1272.png',
      label: 'today-1692',
      url: '/partners/overview',
      viewport: { width: 1692, height: 1272 },
    });
    await captureState(page, report, {
      fileName: '02-7d-1440x900.png',
      label: '7d-1440',
      url: '/partners/overview?range=7d',
      viewport: { width: 1440, height: 900 },
    });

    const financeSection = page
      .getByRole('heading', { name: 'Finance and wallet risk' })
      .locator('xpath=ancestor::section[1]');
    if ((await financeSection.count()) > 0) {
      await financeSection.screenshot({ path: path.join(__dirname, '03-7d-finance-section.png') });
    }
    const selectionSection = page
      .getByRole('heading', { name: 'Selection friction' })
      .locator('xpath=ancestor::section[1]');
    if ((await selectionSection.count()) > 0) {
      await selectionSection.screenshot({ path: path.join(__dirname, '04-7d-selection-section.png') });
    }

    await captureState(page, report, {
      fileName: '05-30d-1440x900.png',
      label: '30d-1440',
      url: '/partners/overview?range=30d',
      viewport: { width: 1440, height: 900 },
    });
    await captureState(page, report, {
      fileName: '06-90d-1440x900.png',
      label: '90d-1440',
      url: '/partners/overview?range=90d',
      viewport: { width: 1440, height: 900 },
    });
    await captureState(page, report, {
      fileName: '07-negative-wallet-1440x900.png',
      label: 'negative-wallet-1440',
      url: '/partners/overview?range=today&walletStatus=negative',
      viewport: { width: 1440, height: 900 },
    });
    await captureState(page, report, {
      fileName: '08-no-data-1440x900.png',
      label: 'no-data-1440',
      url: '/partners/overview?range=7d&city=__verification_no_match__',
      viewport: { width: 1440, height: 900 },
    });

    await page.goto(`${baseUrl}/partners/overview?range=7d`, { waitUntil: 'networkidle' });
    const exactLink = page.locator('a.partner-overview-priority-card').first();
    if ((await exactLink.count()) > 0) {
      const sourceHref = await exactLink.getAttribute('href');
      const sourceCardText = await exactLink.innerText();
      await Promise.all([
        page.waitForURL((url) => url.pathname === '/partners'),
        exactLink.click(),
      ]);
      await page.waitForLoadState('networkidle');
      report.drilldown = {
        destinationUrl: page.url(),
        destinationHasPartnerDirectory:
          (await page.getByRole('heading', { name: 'Partner directory', exact: true }).count()) > 0,
        destinationSummary: (await page.locator('main.content').innerText()).slice(0, 2000),
        sourceCardText,
        sourceHref,
      };
      await page.screenshot({ path: path.join(__dirname, '09-exact-drilldown.png') });
    }
  } finally {
    fs.writeFileSync(
      path.join(__dirname, 'browser-verification.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
