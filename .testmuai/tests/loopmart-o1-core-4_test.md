---
mode: testing
max_steps: 50
timeout: 300
target: cdp
cdp_endpoint: http://127.0.0.1:9222
headless: true
---

# Session: loopmart-o1-core

## Step 1
Go to https://kane-loop-loopmart.vercel.app/index.html, verify the page shows three products named Loop Mug, Debug Hoodie, and Kane Notebook with prices £15.00, £35.00, and £10.00, and verify the cart is empty. Click Add to cart on Loop Mug, then verify the cart shows 1 Loop Mug and the subtotal is £15.00. Click Add to cart on Debug Hoodie, then verify the subtotal is £50.00. Type KANE10 into the discount code field and click Apply, then verify the discount is minus £5.00 and the total is £45.00. Store the displayed total as 'total'. Click the Pay button, wait for the confirmation, then verify the confirmation shows Total paid £45.00 and an order number. Verify the order ledger contains exactly one order for this checkout with the same items, discount, and total as the confirmation, and verify the stock count for Loop Mug and Debug Hoodie has each decreased by exactly 1.
