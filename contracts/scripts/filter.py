import csv
import io
import os

def filter_csv_by_risk_score(input_file, output_file, threshold=50.0):
    """
    Reads a CSV file, filters rows where the 'riskscore' (Column B, index 1)
    is below the specified threshold, and writes the results to a new CSV file.
    """
    print(f"Starting filter. Reading from {input_file}...")
    filtered_rows = []
    
    try:
        # 'r' is for read mode, 'newline=' is for consistent CSV handling across systems
        with open(input_file, 'r', newline='') as infile:
            reader = csv.reader(infile)
            
            # Read and keep the header row
            header = next(reader)
            filtered_rows.append(header)
            
            # Process data rows
            rows_filtered_out = 0
            for row in reader:
                if len(row) > 1: # Ensure a second column (riskscore) exists
                    try:
                        # Column B is at index 1
                        risk_score = float(row[1])
                        
                        # Keep the row if the risk_score is NOT below the threshold (i.e., >= 50)
                        if risk_score >= threshold:
                            filtered_rows.append(row)
                        else:
                            rows_filtered_out += 1
                            
                    except ValueError:
                        print(f"Warning: Non-numeric value '{row[1]}' in Column B. Skipping row.")
                        pass
                
    except FileNotFoundError:
        print(f"Error: Input file '{input_file}' not found. Please ensure 'riskscore.csv' exists in the same directory.")
        return

    # Write the filtered data
    with open(output_file, 'w', newline='') as outfile:
        writer = csv.writer(outfile)
        writer.writerows(filtered_rows)

    print(f"Filtering complete. Output saved to {output_file}.")
    print(f"Rows kept (excluding header): {len(filtered_rows) - 1}")
    print(f"Rows filtered out: {rows_filtered_out}")


if __name__ == "__main__":
    # The script now expects 'riskscore.csv' to be in the same directory.
    INPUT_FILE = 'riskscore.csv'
    OUTPUT_FILE = 'filtered_riskscore.csv'
    THRESHOLD = 50.0
    
    # Run the filtering logic
    filter_csv_by_risk_score(INPUT_FILE, OUTPUT_FILE, THRESHOLD)
