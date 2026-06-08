import { test, expect } from '@playwright/test';

test('基础页面加载与出价面板测试', async ({ page }) => {
  // 1. 访问竞拍页面 (带上 roomId)
  await page.goto('/?roomId=101');

  // 2. 检查页面标题
  await expect(page).toHaveTitle(/frontend-client/);

  // 3. 检查底部出价卡片是否渲染
  const auctionCard = page.locator('.auction-card');
  await expect(auctionCard).toBeVisible();

  // 4. 点击顶栏展开/收起面板
  const topBar = page.locator('.card-top-bar');
  await topBar.click();

  // 5. 检查确认出价按钮是否存在
  const bidButton = page.locator('.bid-button');
  await expect(bidButton).toBeVisible();

  // 6. 检查“直播间”按钮是否存在并可点击
  const roomsBtn = page.locator('.rooms-trigger-btn');
  await expect(roomsBtn).toBeVisible();
  await roomsBtn.click();

  // 7. 检查直播间列表抽屉是否弹出
  const drawer = page.locator('.room-list-drawer');
  await expect(drawer).toBeVisible();
});

test('手机端适配测试', async ({ page, isMobile }) => {
  await page.goto('/?roomId=101');
  
  if (isMobile) {
    // 检查是否隐藏了某些桌面端元素，或调整了布局
    const container = page.locator('.auction-page-container');
    const box = await container.boundingBox();
    expect(box?.width).toBeLessThan(640);
  }
});
