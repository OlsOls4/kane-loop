---
mode: testing
max_steps: 50
timeout: 300
target: cdp
cdp_endpoint: http://127.0.0.1:9222
headless: true
---

# Session: loopmart-chaos-sweep

## Step 1
Go to https://kane-loop-loopmart.vercel.app/index.html and read the prices shown for each product on the page. Add 2 Kane Notebooks and 1 Loop Mug to the cart. Work out the subtotal yourself from the prices you read, apply the discount code KANE10, and work out the total yourself from the subtotal and the 10 percent discount. Verify the cart total shown on the page matches the total you worked out. Then set the Loop Mug quantity to 0, verify the cart updates to show only the notebooks and the total matches the total you work out for 2 notebooks with the discount applied. Then click the Pay button twice in quick succession, wait for the confirmation, and verify the order ledger contains exactly one order for this checkout and the stock count for Kane Notebook has decreased by exactly 2 and no other product stock has changed. Then click "Start new order" and verify the order ledger still shows the earlier order.
