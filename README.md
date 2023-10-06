# Liquity LUSD redemption frontend
When LUSD trades below redemption price (`$0.995`), the Liquity protocol offers [redemptions](https://www.liquity.org/blog/understanding-liquitys-redemption-mechanism): users can burn their LUSD against the currently most risky Trove, and take ETH out of that trove at market price, minus the redemption fee (0.5%).

This frontend aims to provide LUSD redemptions. To the best of my knowledge, no [existing Liquity frontends](https://www.liquity.org/frontend) currently offer this functionality.

Code provided as is, with no warranties of any kind, use at your own risk and responsibility.
