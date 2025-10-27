import csv

# Default values (can be modified)
offerLimitInCRC = 24 * 10**18
tokenPriceInCRC = 22000 * 10**18 

# Read CSV file and calculate total weight
total_weight = 0
csv_filename = 'filtered_riskscore.csv'  # Change this to your CSV filename

try:
    with open(csv_filename, 'r') as file:
        csv_reader = csv.reader(file)
        for row in csv_reader:
            if len(row) >= 3:
                # Get the third element (index 2) and convert to integer
                weight = int(row[2])
                total_weight += weight
    
    print(f"Total Weight (sum of third column): {total_weight}")
    print(f"Total Weight formatted: {total_weight:,}")
    
    # Calculate required deposit amount
    # Formula: offerLimitInCRC * totalWeight * 10**18 / (10000 * tokenPriceInCRC)
    requiredDepositAmount = (offerLimitInCRC * total_weight * 10**18) / (10000 * tokenPriceInCRC)
    
    print(f"\nCalculation Parameters:")
    print(f"offerLimitInCRC: {offerLimitInCRC}")
    print(f"tokenPriceInCRC: {tokenPriceInCRC}")
    
    print(f"\nRequired Deposit Amount: {requiredDepositAmount}")
    print(f"Required Deposit Amount (scientific): {requiredDepositAmount:.2e}")
    
except FileNotFoundError:
    print(f"Error: File '{csv_filename}' not found in the current directory.")
except ValueError as e:
    print(f"Error: Could not convert value to integer. {e}")
except Exception as e:
    print(f"An error occurred: {e}")