"""
Data Processor for Lab Research Analysis

This module handles data loading, processing, and statistical analysis
for research logs. It implements lazy loading for heavy attachments,
only downloading files from cloud storage when explicitly requested.
"""

import pandas as pd
import numpy as np
from typing import Optional, Dict, Any, Tuple
import os
from pathlib import Path


class DataProcessor:
    """Processes research data with lazy loading from cloud storage."""
    
    def __init__(self, local_cache_dir: str = "local_data_cache"):
        """
        Initialize the data processor.
        
        Args:
            local_cache_dir: Directory to store locally downloaded files
        """
        self.local_cache_dir = Path(local_cache_dir)
        self.local_cache_dir.mkdir(exist_ok=True)
        print(f"Data processor initialized. Local cache: {self.local_cache_dir.absolute()}")
    
    def _is_file_downloaded(self, file_path: str) -> bool:
        """
        Check if a file exists locally.
        
        Args:
            file_path: Path to the file (can be local path or cloud URL)
            
        Returns:
            True if file exists locally, False otherwise
        """
        # If it's a URL, check if we have a cached local copy
        if file_path.startswith(('http://', 'https://')):
            # Extract filename from URL for local cache lookup
            filename = file_path.split('/')[-1]
            local_path = self.local_cache_dir / filename
            return local_path.exists()
        
        # If it's a local path, check directly
        return Path(file_path).exists()
    
    def _download_from_cloud(self, cloud_url: str) -> str:
        """
        Mock download from cloud storage.
        
        In production, this would integrate with cloud storage (Supabase, S3, etc.)
        to download the file. For now, it simulates the download process.
        
        Args:
            cloud_url: URL to the file in cloud storage
            
        Returns:
            Local path to the downloaded file
        """
        print(f"⬇️  Downloading from cloud: {cloud_url}")
        
        # Extract filename from URL
        filename = cloud_url.split('/')[-1]
        local_path = self.local_cache_dir / filename
        
        # Mock download - in production, use actual cloud SDK
        # Example: supabase.storage.from_('bucket').download(filename)
        print(f"   → Simulating download to: {local_path}")
        
        # For testing, create a mock CSV file if it doesn't exist
        if not local_path.exists() and cloud_url.endswith('.csv'):
            self._create_mock_csv(local_path)
        
        return str(local_path)
    
    def _create_mock_csv(self, file_path: Path) -> None:
        """
        Create a mock CSV file for testing purposes.
        
        Args:
            file_path: Path where the mock CSV should be created
        """
        # Generate sample sensor data
        np.random.seed(42)
        data = {
            'timestamp': pd.date_range('2024-01-01', periods=100, freq='1min'),
            'sensor_1': np.random.normal(25, 2, 100),
            'sensor_2': np.random.normal(100, 10, 100),
            'sensor_3': np.random.normal(50, 5, 100),
            'temperature': np.random.normal(22, 1, 100),
            'humidity': np.random.normal(45, 5, 100)
        }
        df = pd.DataFrame(data)
        df.to_csv(file_path, index=False)
        print(f"   → Created mock CSV with {len(df)} rows")
    
    def _get_local_path(self, file_path: str) -> str:
        """
        Get the local path for a file, handling both local paths and cloud URLs.
        
        Args:
            file_path: Local path or cloud URL
            
        Returns:
            Local file path
        """
        if file_path.startswith(('http://', 'https://')):
            filename = file_path.split('/')[-1]
            return str(self.local_cache_dir / filename)
        return file_path
    
    def load_data(self, file_path: str, force_download: bool = False) -> pd.DataFrame:
        """
        Load data from a file with lazy loading support.
        
        This function checks if the file is downloaded locally. If not,
        it triggers a download from cloud storage before loading.
        
        Args:
            file_path: Path to the file (local path or cloud URL)
            force_download: If True, force download even if file exists locally
            
        Returns:
            Pandas DataFrame containing the loaded data
            
        Raises:
            FileNotFoundError: If file cannot be loaded after download attempt
            ValueError: If file format is not supported
        """
        print(f"\n📂 Loading data from: {file_path}")
        
        # Check if file is downloaded locally
        is_downloaded = self._is_file_downloaded(file_path)
        
        if not is_downloaded or force_download:
            if file_path.startswith(('http://', 'https://')):
                # Trigger download from cloud
                local_path = self._download_from_cloud(file_path)
                print(f"   → Download complete: {local_path}")
            else:
                raise FileNotFoundError(f"Local file not found: {file_path}")
        else:
            local_path = self._get_local_path(file_path)
            print(f"   → Using cached local file: {local_path}")
        
        # Load the file based on extension
        file_ext = Path(local_path).suffix.lower()
        
        try:
            if file_ext == '.csv':
                df = pd.read_csv(local_path)
            elif file_ext in ['.xlsx', '.xls']:
                df = pd.read_excel(local_path)
            elif file_ext == '.json':
                df = pd.read_json(local_path)
            elif file_ext == '.parquet':
                df = pd.read_parquet(local_path)
            else:
                raise ValueError(f"Unsupported file format: {file_ext}")
            
            print(f"   → Loaded {len(df)} rows, {len(df.columns)} columns")
            return df
            
        except Exception as e:
            print(f"   ❌ Error loading file: {e}")
            raise
    
    def get_statistics(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Calculate basic statistics for a DataFrame.
        
        Args:
            df: Pandas DataFrame to analyze
            
        Returns:
            Dictionary containing statistical summary
        """
        print("\n📊 Calculating statistics...")
        
        # Filter only numeric columns
        numeric_df = df.select_dtypes(include=[np.number])
        
        if numeric_df.empty:
            print("   ⚠️  No numeric columns found")
            return {}
        
        stats = {}
        
        for column in numeric_df.columns:
            col_stats = {
                'mean': float(numeric_df[column].mean()),
                'max': float(numeric_df[column].max()),
                'min': float(numeric_df[column].min()),
                'std': float(numeric_df[column].std()),
                'median': float(numeric_df[column].median()),
                'count': int(numeric_df[column].count())
            }
            stats[column] = col_stats
            
            print(f"   {column}:")
            print(f"     Mean:   {col_stats['mean']:.2f}")
            print(f"     Max:    {col_stats['max']:.2f}")
            print(f"     Min:    {col_stats['min']:.2f}")
            print(f"     Std:    {col_stats['std']:.2f}")
            print(f"     Median: {col_stats['median']:.2f}")
        
        return stats
    
    def analyze_file(self, file_path: str, force_download: bool = False) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Complete analysis pipeline: load file and calculate statistics.
        
        This is the main entry point for data analysis. It handles lazy loading
        and returns both the raw data and computed statistics.
        
        Args:
            file_path: Path to the file (local path or cloud URL)
            force_download: If True, force download even if file exists locally
            
        Returns:
            Tuple of (DataFrame, statistics dictionary)
        """
        try:
            # Load data with lazy download check
            df = self.load_data(file_path, force_download)
            
            # Calculate statistics
            stats = self.get_statistics(df)
            
            return df, stats
            
        except Exception as e:
            print(f"❌ Analysis failed: {e}")
            raise
    
    def filter_data(self, df: pd.DataFrame, column: str, 
                   min_value: Optional[float] = None, 
                   max_value: Optional[float] = None) -> pd.DataFrame:
        """
        Filter DataFrame based on column value range.
        
        Args:
            df: Pandas DataFrame to filter
            column: Column name to filter on
            min_value: Minimum value (inclusive)
            max_value: Maximum value (inclusive)
            
        Returns:
            Filtered DataFrame
        """
        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found in DataFrame")
        
        filtered_df = df.copy()
        
        if min_value is not None:
            filtered_df = filtered_df[filtered_df[column] >= min_value]
        
        if max_value is not None:
            filtered_df = filtered_df[filtered_df[column] <= max_value]
        
        print(f"🔍 Filtered {len(df)} → {len(filtered_df)} rows")
        return filtered_df
    
    def get_column_info(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Get information about DataFrame columns.
        
        Args:
            df: Pandas DataFrame to analyze
            
        Returns:
            Dictionary with column information
        """
        info = {
            'total_rows': len(df),
            'total_columns': len(df.columns),
            'columns': {}
        }
        
        for column in df.columns:
            info['columns'][column] = {
                'dtype': str(df[column].dtype),
                'null_count': int(df[column].isnull().sum()),
                'unique_count': int(df[column].nunique())
            }
        
        return info


# Convenience function for quick analysis
def analyze_file(file_path: str, force_download: bool = False) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Quick function to analyze a file with lazy loading.
    
    Args:
        file_path: Path to the file (local path or cloud URL)
        force_download: If True, force download even if file exists locally
        
    Returns:
        Tuple of (DataFrame, statistics dictionary)
    """
    processor = DataProcessor()
    return processor.analyze_file(file_path, force_download)


if __name__ == "__main__":
    # Test the data processor
    print("=== Testing Data Processor ===\n")
    
    # Test with a cloud URL (will trigger mock download)
    cloud_url = "https://cloud.example.com/bucket/sensor_data.csv"
    
    try:
        df, stats = analyze_file(cloud_url)
        print(f"\n✅ Analysis complete!")
        print(f"   DataFrame shape: {df.shape}")
        print(f"   Statistics for {len(stats)} columns")
        
        # Test column info
        processor = DataProcessor()
        info = processor.get_column_info(df)
        print(f"\n📋 Column Info:")
        print(f"   Total rows: {info['total_rows']}")
        print(f"   Total columns: {info['total_columns']}")
        
    except Exception as e:
        print(f"Test failed: {e}")
