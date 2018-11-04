# PCPartPicker Calculator


This Node script will parse the items that you feed through an HTML file from PCPartPicker's `/list/` directory and then calculates the shipping cost based on the weight and the cost.


This includes a test `parts.html` file to see if the script works.

The current rule is: `(weight * 7) + The price of the item`


TODO: Make the shipping cost rules editable through the command-line.