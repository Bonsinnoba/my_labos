"""
Local SQLite Cache Database for Lab Inventory & Research Logs

This module handles the local SQLite database that serves as a cache for
offline access. It stores structured text data (equipment tables, log titles,
metadata) that can sync with a cloud PostgreSQL database asynchronously.
"""

import sqlite3
import os
import json
import hashlib
import time
from datetime import datetime
from typing import Optional, List, Dict, Any

from lab_app.auth.audit_logger import AuditLogger


class CacheDatabase:
    """Manages local SQLite database for offline-first lab application."""
    
    def __init__(self, db_path: str = "local_cache.db", device_id: Optional[str] = None):
        """
        Initialize the cache database.
        
        Args:
            db_path: Path to the SQLite database file. Defaults to 'local_cache.db'
                     in the current working directory.
            device_id: Unique identifier for this workstation for mesh sync.
                      If not provided, will generate one.
        """
        self.db_path = db_path
        self.device_id = device_id or self._get_or_generate_device_id()
        self.conn: Optional[sqlite3.Connection] = None
        self._initialize_database()
        
        # Initialize audit logger for tracking who did what when
        self.audit_logger = AuditLogger(db_path)
    
    def _log_audit(self, action: str, table_name: str, record_id: int,
                  user_id: Optional[str] = None, personnel_name: Optional[str] = None,
                  details: Optional[Dict] = None) -> None:
        """
        Log an audit action using the audit logger.
        
        Args:
            action: Action type (create, update, delete)
            table_name: Name of the table
            record_id: ID of the record
            user_id: User ID (for mobile)
            personnel_name: Personnel name (optional)
            details: Additional details
        """
        # Use device_id for desktop, user_id for mobile
        identifier = user_id if user_id else self.device_id
        self.audit_logger.log_action(
            action=action,
            table_name=table_name,
            record_id=record_id,
            user_id=user_id,
            device_id=self.device_id if not user_id else None,
            personnel_name=personnel_name,
            details=details
        )
    
    def _initialize_database(self) -> None:
        """Create database tables if they don't exist."""
        try:
            self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
            self.conn.row_factory = sqlite3.Row  # Enable dictionary-like access
            
            cursor = self.conn.cursor()
            
            # Create equipment table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS equipment (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    model TEXT,
                    status TEXT NOT NULL DEFAULT 'available',
                    calibration_date TEXT,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by TEXT,
                    edited_by TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create projects table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS projects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    description TEXT,
                    status TEXT NOT NULL DEFAULT 'Active',
                    start_date TEXT,
                    summary_findings TEXT,
                    project_outcome TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by TEXT,
                    edited_by TEXT,
                    edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create rd_logs table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS rd_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id INTEGER,
                    project_name TEXT,
                    log_title TEXT NOT NULL,
                    log_text TEXT,
                    cloud_file_url TEXT,
                    is_downloaded_locally INTEGER DEFAULT 0,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    status TEXT DEFAULT 'Active',
                    created_by TEXT,
                    edited_by TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
                )
            """)
            
            # Create indexes for better query performance
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_equipment_status 
                ON equipment(status)
            """)
            
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_rd_logs_project 
                ON rd_logs(project_name)
            """)
            
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_rd_logs_project_id 
                ON rd_logs(project_id)
            """)
            
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_rd_logs_downloaded 
                ON rd_logs(is_downloaded_locally)
            """)
            
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_projects_status 
                ON projects(status)
            """)
            
            # Migration: Add project_id column to existing rd_logs if it doesn't exist
            self._migrate_rd_logs_table(cursor)
            
            # Migration: Add outcome column to existing rd_logs
            self._migrate_rd_logs_outcome(cursor)
            
            # Migration: Add stage_id column to rd_logs so experiments can be linked to stages
            self._migrate_rd_logs_add_stage_id(cursor)
            
            # Migration: Add status column to rd_logs for pause/continue functionality
            self._migrate_rd_logs_add_status(cursor)
            
            # Migration: Add expected_outcome, actual_outcome, and findings columns to rd_logs
            self._migrate_rd_logs_add_experiment_fields(cursor)
            
            # Migration: Add cloud sync fields to knowledge_vault if they don't exist
            self._migrate_knowledge_vault_cloud_fields(cursor)
            
            # Migration: Add is_tombstone columns to primary data tables
            self._migrate_add_is_tombstone(cursor)
            
            # Create Phase 4 tables
            self._create_phase4_tables(cursor)

            # Migration: Rename summary_findings -> project_outcome on projects
            self._migrate_projects_rename_summary_findings(cursor)

            # Migration: Add conclusion column to rd_logs
            self._migrate_rd_logs_add_conclusion(cursor)

            # Migration: Add stage_id to findings table
            self._migrate_findings_add_stage_id(cursor)

            # Migration: Add experiment_id and stage_id to knowledge_vault
            self._migrate_knowledge_vault_add_exp_stage(cursor)

            # Create mesh_transactions table for decentralized sync
            self._create_mesh_transactions_table(cursor)
            
            self.conn.commit()
            print(f"Database initialized successfully at: {os.path.abspath(self.db_path)}")
            
        except sqlite3.Error as e:
            print(f"Database initialization error: {e}")
            raise
    
    def _migrate_rd_logs_table(self, cursor: sqlite3.Cursor) -> None:
        """
        Migrate existing rd_logs table to include project_id column.
        
        Args:
            cursor: Database cursor
        """
        try:
            # Check if project_id column exists
            cursor.execute("PRAGMA table_info(rd_logs)")
            columns = [column[1] for column in cursor.fetchall()]
            
            if 'project_id' not in columns:
                print("[db] Migrating rd_logs table: adding project_id column...")
                cursor.execute("ALTER TABLE rd_logs ADD COLUMN project_id INTEGER")
                print("[db] Migration complete: project_id column added")
            else:
                print("[db] rd_logs table already has project_id column")
                
        except sqlite3.Error as e:
            print(f"[db] Migration warning (project_id): {e}")
            # Don't raise error - migration is optional

    def _migrate_rd_logs_outcome(self, cursor: sqlite3.Cursor) -> None:
        """Add outcome column to rd_logs for storing experiment results."""
        try:
            cursor.execute("PRAGMA table_info(rd_logs)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'outcome' not in columns:
                print("[db] Migrating rd_logs table: adding outcome column...")
                cursor.execute("ALTER TABLE rd_logs ADD COLUMN outcome TEXT DEFAULT 'PENDING'")
                print("[db] Migration complete: outcome column added")
        except sqlite3.Error as e:
            print(f"[db] Migration warning (outcome): {e}")

    def _migrate_rd_logs_add_stage_id(self, cursor: sqlite3.Cursor) -> None:
        """
        Migrate existing rd_logs table to include stage_id column.
        """
        try:
            cursor.execute("PRAGMA table_info(rd_logs)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'stage_id' not in columns:
                print("[db] Migrating rd_logs table: adding stage_id column...")
                cursor.execute("ALTER TABLE rd_logs ADD COLUMN stage_id INTEGER")
                try:
                    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rd_logs_stage_id ON rd_logs(stage_id)")
                except sqlite3.Error:
                    pass
                print("[db] Migration complete: stage_id column added")
            else:
                print("[db] rd_logs table already has stage_id column")
        except sqlite3.Error as e:
            print(f"[db] Migration warning (stage_id): {e}")
    
    def _migrate_rd_logs_add_status(self, cursor: sqlite3.Cursor) -> None:
        """
        Migrate existing rd_logs table to include status column for pause/continue functionality.
        
        Args:
            cursor: Database cursor
        """
        try:
            # Check if status column exists
            cursor.execute("PRAGMA table_info(rd_logs)")
            columns = [column[1] for column in cursor.fetchall()]
            
            if 'status' not in columns:
                print("[db] Migrating rd_logs table: adding status column...")
                cursor.execute("ALTER TABLE rd_logs ADD COLUMN status TEXT DEFAULT 'Active'")
                print("[db] Migration complete: status column added")
            else:
                print("[db] rd_logs table already has status column")
        except sqlite3.Error as e:
            print(f"[db] Migration warning (status): {e}")

    def _migrate_rd_logs_add_experiment_fields(self, cursor: sqlite3.Cursor) -> None:
        """
        Migrate existing rd_logs table to include expected_outcome, actual_outcome, findings, and attachment columns.
        
        Args:
            cursor: Database cursor
        """
        try:
            cursor.execute("PRAGMA table_info(rd_logs)")
            columns = [column[1] for column in cursor.fetchall()]
            
            if 'expected_outcome' not in columns:
                print("[db] Migrating rd_logs table: adding expected_outcome column...")
                cursor.execute("ALTER TABLE rd_logs ADD COLUMN expected_outcome TEXT")
                print("[db] Migration complete: expected_outcome column added")
            else:
                print("[db] rd_logs table already has expected_outcome column")
                
            if 'actual_outcome' not in columns:
                print("[db] Migrating rd_logs table: adding actual_outcome column...")
                cursor.execute("ALTER TABLE rd_logs ADD COLUMN actual_outcome TEXT")
                print("[db] Migration complete: actual_outcome column added")
            else:
                print("[db] rd_logs table already has actual_outcome column")
                
            if 'findings' not in columns:
                print("[db] Migrating rd_logs table: adding findings column...")
                cursor.execute("ALTER TABLE rd_logs ADD COLUMN findings TEXT")
                print("[db] Migration complete: findings column added")
            else:
                print("[db] rd_logs table already has findings column")
                
            if 'outcome_attachments' not in columns:
                print("[db] Migrating rd_logs table: adding outcome_attachments column...")
                cursor.execute("ALTER TABLE rd_logs ADD COLUMN outcome_attachments TEXT")
                print("[db] Migration complete: outcome_attachments column added")
            else:
                print("[db] rd_logs table already has outcome_attachments column")
                
            if 'findings_attachments' not in columns:
                print("[db] Migrating rd_logs table: adding findings_attachments column...")
                cursor.execute("ALTER TABLE rd_logs ADD COLUMN findings_attachments TEXT")
                print("[db] Migration complete: findings_attachments column added")
            else:
                print("[db] rd_logs table already has findings_attachments column")
        except sqlite3.Error as e:
            print(f"[db] Migration warning (experiment fields): {e}")

    def _migrate_knowledge_vault_cloud_fields(self, cursor: sqlite3.Cursor) -> None:
        """
        Migrate existing knowledge_vault table to include cloud sync fields.
        
        Args:
            cursor: Database cursor
        """
        try:
            # Check if cloud sync columns exist
            cursor.execute("PRAGMA table_info(knowledge_vault)")
            columns = [column[1] for column in cursor.fetchall()]
            
            if 'cloud_file_url' not in columns:
                print("[db] Migrating knowledge_vault table: adding cloud_file_url column...")
                cursor.execute("ALTER TABLE knowledge_vault ADD COLUMN cloud_file_url TEXT")
                print("[db] Migration complete: cloud_file_url column added")
            else:
                print("[db] knowledge_vault table already has cloud_file_url column")
            
            if 'is_synced' not in columns:
                print("[db] Migrating knowledge_vault table: adding is_synced column...")
                cursor.execute("ALTER TABLE knowledge_vault ADD COLUMN is_synced INTEGER DEFAULT 0")
                print("[db] Migration complete: is_synced column added")
            else:
                print("[db] knowledge_vault table already has is_synced column")
                
        except sqlite3.Error as e:
            print(f"[db] Migration warning: {e}")
            # Don't raise error - migration is optional

    def _migrate_add_is_tombstone(self, cursor: sqlite3.Cursor) -> None:
        """
        Add is_tombstone columns to primary data tables for soft deletion support.
        
        Args:
            cursor: Database cursor
        """
        tables_to_migrate = ['projects', 'rd_logs', 'findings', 'project_stages', 'experiment_stages', 'knowledge_vault']
        
        for table in tables_to_migrate:
            try:
                cursor.execute(f"PRAGMA table_info({table})")
                columns = [column[1] for column in cursor.fetchall()]
                
                if 'is_tombstone' not in columns:
                    print(f"[db] Migrating {table} table: adding is_tombstone column...")
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN is_tombstone INTEGER DEFAULT 0")
                    print(f"[db] Migration complete: is_tombstone column added to {table}")
                else:
                    print(f"[db] {table} table already has is_tombstone column")
            except sqlite3.Error as e:
                print(f"[db] Migration warning (is_tombstone for {table}): {e}")
                # Don't raise error - migration is optional
    
    def _create_phase4_tables(self, cursor: sqlite3.Cursor) -> None:
        """
        Create all Phase 4 database tables for the Knowledge Intelligence System.
        
        Args:
            cursor: Database cursor
        """
        # Knowledge Vault table - stores documents (PDFs, datasheets, images, etc.)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_vault (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_type TEXT NOT NULL,
                file_size INTEGER,
                description TEXT,
                metadata TEXT,
                tags TEXT,
                project_id INTEGER,
                component_id INTEGER,
                equipment_id INTEGER,
                experiment_id INTEGER,
                stage_id INTEGER,
                upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_accessed TIMESTAMP,
                created_by TEXT,
                edited_by TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
                FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE SET NULL,
                FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE SET NULL
            )
        """)
        
        # Engineering Notebook table - journal entries
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notebook_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                entry_type TEXT DEFAULT 'text',
                project_id INTEGER,
                experiment_id INTEGER,
                tags TEXT,
                attachments TEXT,
                voice_transcription TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by TEXT,
                edited_by TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
            )
        """)
        
        # Components table - inventory management
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS components (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                part_number TEXT UNIQUE,
                description TEXT,
                quantity INTEGER DEFAULT 0,
                min_quantity INTEGER DEFAULT 5,
                storage_location TEXT,
                datasheet TEXT,
                supplier TEXT,
                supplier_part_number TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Enhanced Equipment table - add calibration and maintenance tracking
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS equipment_maintenance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                equipment_id INTEGER NOT NULL,
                maintenance_type TEXT NOT NULL,
                description TEXT,
                performed_date TEXT,
                next_due_date TEXT,
                performed_by TEXT,
                notes TEXT,
                FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
            )
        """)
        
        # Findings and Lessons table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS findings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                finding_type TEXT NOT NULL,
                description TEXT NOT NULL,
                root_cause TEXT,
                solution TEXT,
                recommendations TEXT,
                project_id INTEGER,
                experiment_id INTEGER,
                stage_id INTEGER,
                severity TEXT DEFAULT 'medium',
                status TEXT DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
            )
        """)
        
        # Calculations table - stored engineering calculations
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS calculations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                calculation_type TEXT NOT NULL,
                input_parameters TEXT NOT NULL,
                result TEXT NOT NULL,
                formula TEXT,
                project_id INTEGER,
                component_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
                FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE SET NULL
            )
        """)
        
        # Relationships table - automatic connection tracking
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS relationships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_type TEXT NOT NULL,
                source_id INTEGER NOT NULL,
                target_type TEXT NOT NULL,
                target_id INTEGER NOT NULL,
                relationship_type TEXT NOT NULL,
                confidence REAL DEFAULT 1.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(source_type, source_id, target_type, target_id, relationship_type)
            )
        """)
        
        # Component Usage History table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS component_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                component_id INTEGER NOT NULL,
                project_id INTEGER,
                experiment_id INTEGER,
                quantity_used INTEGER DEFAULT 1,
                usage_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
            )
        """)
        
        # Tools table - inventory management for tools
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tools (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                tool_type TEXT,
                description TEXT,
                quantity INTEGER DEFAULT 1,
                min_quantity INTEGER DEFAULT 1,
                storage_location TEXT,
                status TEXT DEFAULT 'available',
                purchase_date TEXT,
                supplier TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Materials table - inventory management for materials
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS materials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                material_type TEXT,
                description TEXT,
                quantity REAL DEFAULT 0,
                unit TEXT DEFAULT 'units',
                min_quantity REAL DEFAULT 10,
                storage_location TEXT,
                purchase_date TEXT,
                supplier TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Equipment Usage History table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS equipment_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                equipment_id INTEGER NOT NULL,
                project_id INTEGER,
                experiment_id INTEGER,
                usage_type TEXT DEFAULT 'checkout',
                usage_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                return_date TIMESTAMP,
                used_by TEXT,
                post_use_status TEXT DEFAULT 'usable',
                condition_notes TEXT,
                efficiency_percentage REAL,
                notes TEXT,
                FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
            )
        """)
        
        # Tools Usage History table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tool_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tool_id INTEGER NOT NULL,
                project_id INTEGER,
                experiment_id INTEGER,
                quantity_used INTEGER DEFAULT 1,
                amount_left INTEGER DEFAULT 0,
                usage_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                post_use_status TEXT DEFAULT 'usable',
                condition_notes TEXT,
                efficiency_percentage REAL,
                notes TEXT,
                FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
            )
        """)
        
        # Materials Usage History table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS material_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                material_id INTEGER NOT NULL,
                project_id INTEGER,
                experiment_id INTEGER,
                quantity_used REAL DEFAULT 0,
                amount_left REAL DEFAULT 0,
                usage_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                post_use_status TEXT DEFAULT 'usable',
                condition_notes TEXT,
                notes TEXT,
                FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
            )
        """)

        # General Usage Logs table - consolidated usage tracking
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS usage_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER,
                experiment_id INTEGER,
                stage_id INTEGER,
                entity_type TEXT NOT NULL, -- component/tool/material/equipment
                entity_id INTEGER,
                quantity_used REAL DEFAULT 0,
                unit TEXT,
                amount_left REAL,
                post_use_status TEXT,
                notes TEXT,
                user_id INTEGER DEFAULT 1,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
                FOREIGN KEY (stage_id) REFERENCES experiment_stages(id) ON DELETE SET NULL
            )
        """)

        # Project stages table - records stages of a project
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_stages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                stage_name TEXT NOT NULL,
                owner TEXT,
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                status TEXT DEFAULT 'not_started',
                notes TEXT,
                attachments TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                UNIQUE(project_id, stage_name)
            )
        """)

        # Experiment stages table - records stages of an experiment
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS experiment_stages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                experiment_id INTEGER NOT NULL,
                stage_name TEXT NOT NULL,
                owner TEXT,
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                status TEXT DEFAULT 'not_started',
                notes TEXT,
                attachments TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (experiment_id) REFERENCES rd_logs(id) ON DELETE CASCADE,
                UNIQUE(experiment_id, stage_name)
            )
        """)

        # Ensure migration from older schema (where experiment_stages had project_id)
        self._migrate_experiment_stages_table(cursor)
        # Ensure migration from older usage_logs schema to include stage_id
        self._migrate_usage_logs_table(cursor)
        
        # Funding Sources table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS funding_sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                source_type TEXT NOT NULL,
                description TEXT,
                budget_limit REAL,
                current_balance REAL DEFAULT 0,
                account_number TEXT,
                contact_person TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Purchases table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS purchases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_type TEXT NOT NULL,
                item_id INTEGER NOT NULL,
                funding_source_id INTEGER,
                purchase_date TEXT NOT NULL,
                cost REAL NOT NULL,
                currency TEXT DEFAULT 'USD',
                vendor TEXT,
                invoice_number TEXT,
                payment_method TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (funding_source_id) REFERENCES funding_sources(id) ON DELETE SET NULL
            )
        """)
        
        # Maintenance Costs table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS maintenance_costs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_type TEXT NOT NULL,
                item_id INTEGER NOT NULL,
                funding_source_id INTEGER,
                maintenance_date TEXT NOT NULL,
                cost REAL NOT NULL,
                currency TEXT DEFAULT 'USD',
                service_provider TEXT,
                description TEXT,
                invoice_number TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (funding_source_id) REFERENCES funding_sources(id) ON DELETE SET NULL
            )
        """)
        
        # Gains/Income table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS gains (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gain_type TEXT NOT NULL,
                amount REAL NOT NULL,
                currency TEXT DEFAULT 'USD',
                gain_date TEXT NOT NULL,
                source TEXT,
                description TEXT,
                funding_source_id INTEGER,
                project_id INTEGER,
                category TEXT,
                status TEXT DEFAULT 'confirmed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (funding_source_id) REFERENCES funding_sources(id) ON DELETE SET NULL
            )
        """)
        
        # Lab Activity Log table - audit trail for all actions
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS lab_activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id INTEGER,
                entity_name TEXT,
                user_id INTEGER DEFAULT 1,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                details TEXT
            )
        """)
        
        # Asset Sync Log table - audit trail for asset uploads and deletions
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS asset_sync_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_name TEXT NOT NULL,
                action_type TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # AI Chat History table - store chat conversations
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ai_chat_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                project_id INTEGER,
                experiment_id INTEGER
            )
        """)
        
        # Create index for asset_sync_log
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_asset_sync_log_timestamp 
            ON asset_sync_log(timestamp)
        """)
        
        # Create indexes for Phase 4 tables
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_knowledge_vault_project 
            ON knowledge_vault(project_id)
        """)
        
        # Create index for ai_chat_history
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_ai_chat_history_session 
            ON ai_chat_history(session_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_knowledge_vault_component 
            ON knowledge_vault(component_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_knowledge_vault_type 
            ON knowledge_vault(file_type)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_notebook_project 
            ON notebook_entries(project_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_notebook_date 
            ON notebook_entries(created_at)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_components_part_number 
            ON components(part_number)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_components_quantity 
            ON components(quantity)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_equipment 
            ON equipment_maintenance(equipment_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_due 
            ON equipment_maintenance(next_due_date)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_findings_project 
            ON findings(project_id)
        """)
        
    def _create_mesh_transactions_table(self, cursor: sqlite3.Cursor) -> None:
        """
        Create the mesh_transactions table for decentralized peer-to-peer synchronization.
        
        This table logs every data mutation chronologically for sync across multiple workstations.
        
        Args:
            cursor: Database cursor
        """
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS mesh_transactions (
                tx_id TEXT PRIMARY KEY,
                table_name TEXT NOT NULL,
                operation TEXT NOT NULL,
                payload TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                device_origin TEXT NOT NULL
            )
        """)
        
        # Create indexes for efficient querying
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_mesh_transactions_timestamp 
            ON mesh_transactions(timestamp)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_mesh_transactions_table 
            ON mesh_transactions(table_name)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_mesh_transactions_device 
            ON mesh_transactions(device_origin)
        """)
        
        print("[db] mesh_transactions table created successfully")
    
    def _get_or_generate_device_id(self) -> str:
        """
        Get existing device ID from local storage or generate a new one.
        
        Returns:
            Device ID string (e.g., 'LAB_PC_01')
        """
        from pathlib import Path
        import uuid
        
        device_id_file = Path(".mesh_device_id")
        
        if device_id_file.exists():
            with open(device_id_file, 'r') as f:
                return f.read().strip()
        
        # Generate new device ID
        device_id = f"LAB_PC_{uuid.uuid4().hex[:6].upper()}"
        with open(device_id_file, 'w') as f:
            f.write(device_id)
        
        print(f"[db] Generated new device ID: {device_id}")
        return device_id
    
    def _log_mutation(self, 
                     table_name: str,
                     operation: str,
                     payload: Dict[str, Any],
                     record_id: Optional[int] = None) -> str:
        """
        Log a data mutation to the local mesh_transactions ledger.
        
        Args:
            table_name: Name of the table being modified
            operation: Type of operation ('INSERT', 'UPDATE', 'DELETE')
            payload: JSON-serializable dict containing modified/mutated fields only
            record_id: Optional ID of the record being modified
            
        Returns:
            Transaction ID
        """
        # Generate transaction ID
        tx_data = f"{table_name}{operation}{json.dumps(payload, sort_keys=True)}{time.time()}{self.device_id}"
        tx_id = hashlib.sha256(tx_data.encode()).hexdigest()[:32]
        
        # Get current timestamp in milliseconds
        timestamp = int(time.time() * 1000)
        
        # Add record_id to payload if provided
        if record_id is not None:
            payload['_record_id'] = record_id
        
        # Serialize payload to JSON
        payload_json = json.dumps(payload)
        
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO mesh_transactions (tx_id, table_name, operation, payload, timestamp, device_origin)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (tx_id, table_name, operation, payload_json, timestamp, self.device_id))
            
            self.conn.commit()
            print(f"[db] Logged mutation: {operation} on {table_name} (tx_id: {tx_id})")
            return tx_id
            
        except sqlite3.Error as e:
            print(f"[db] Error logging mutation: {e}")
            self.conn.rollback()
            raise
    
    # Equipment CRUD Operations
    
    def add_equipment(self, name: str, model: str, status: str = "available",
                     calibration_date: Optional[str] = None) -> int:
        """
        Add a new equipment entry to the database.
        
        Args:
            name: Equipment name
            model: Equipment model
            status: Equipment status (default: 'available')
            calibration_date: Last calibration date
            
        Returns:
            The ID of the inserted equipment
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO equipment (name, model, status, calibration_date)
                VALUES (?, ?, ?, ?)
            """, (name, model, status, calibration_date))
            self.conn.commit()
            
            # Log mutation for mesh sync
            self._log_mutation('equipment', 'INSERT', {
                'name': name,
                'model': model,
                'status': status,
                'calibration_date': calibration_date
            }, cursor.lastrowid)
            
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding equipment: {e}")
            raise
    
    # Asset Sync Log functions for deletion audit
    def record_asset_deletion(self, file_name: str) -> int:
        """
        Record a deletion marker in the asset sync log.
        
        Args:
            file_name: Name of the file being deleted
            
        Returns:
            The ID of the inserted log entry
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO asset_sync_log (file_name, action_type)
                VALUES (?, 'DELETE')
            """, (file_name,))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error recording asset deletion: {e}")
            raise
    
    def get_pending_asset_deletions(self) -> List[Dict[str, Any]]:
        """
        Retrieve all pending asset deletions from the sync log.
        
        Returns:
            List of dictionaries containing deletion log entries
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                SELECT * FROM asset_sync_log 
                WHERE action_type = 'DELETE'
                ORDER BY timestamp ASC
            """)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving pending deletions: {e}")
            raise
    
    def clear_asset_deletion_log(self, log_id: int) -> bool:
        """
        Clear a deletion log entry after processing.
        
        Args:
            log_id: The ID of the log entry to clear
            
        Returns:
            True if successful, False otherwise
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("DELETE FROM asset_sync_log WHERE id = ?", (log_id,))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error clearing deletion log: {e}")
            raise
    
    def close(self) -> None:
        """Close the database connection."""
        if self.conn:
            self.conn.close()
            self.conn = None
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()
    
    # Equipment CRUD Operations
    
    def add_equipment(self, name: str, model: str, status: str = "available", 
                     calibration_date: Optional[str] = None) -> int:
        """
        Add a new equipment entry to the database.
        
        Args:
            name: Equipment name
            model: Equipment model
            status: Equipment status (available, in_use, maintenance, etc.)
            calibration_date: Last calibration date (ISO format string)
            
        Returns:
            The ID of the inserted equipment
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO equipment (name, model, status, calibration_date, last_updated)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (name, model, status, calibration_date))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding equipment: {e}")
            raise
    
    def get_equipment(self, equipment_id: int) -> Optional[Dict[str, Any]]:
        """
        Retrieve a single equipment entry by ID.
        
        Args:
            equipment_id: The equipment ID to retrieve
            
        Returns:
            Dictionary containing equipment data or None if not found
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT * FROM equipment WHERE id = ?", (equipment_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.Error as e:
            print(f"Error retrieving equipment: {e}")
            raise
    
    def get_all_equipment(self) -> List[Dict[str, Any]]:
        """
        Retrieve all equipment entries.
        
        Returns:
            List of dictionaries containing equipment data
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT * FROM equipment ORDER BY name")
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving all equipment: {e}")
            raise
    
    def update_equipment(self, equipment_id: int, **kwargs) -> bool:
        """
        Update equipment fields.
        
        Args:
            equipment_id: The equipment ID to update
            **kwargs: Fields to update (name, model, status, calibration_date)
            
        Returns:
            True if update was successful, False otherwise
        """
        try:
            if not kwargs:
                return False
            
            # Build dynamic update query
            fields = []
            values = []
            for key, value in kwargs.items():
                if key in ['name', 'model', 'status', 'calibration_date']:
                    fields.append(f"{key} = ?")
                    values.append(value)
            
            if not fields:
                return False
            
            # Always update last_updated timestamp
            fields.append("last_updated = CURRENT_TIMESTAMP")
            values.append(equipment_id)
            
            query = f"UPDATE equipment SET {', '.join(fields)} WHERE id = ?"
            cursor = self.conn.cursor()
            cursor.execute(query, values)
            self.conn.commit()
            
            # Log mutation for mesh sync
            self._log_mutation('equipment', 'UPDATE', kwargs, equipment_id)
            
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error updating equipment: {e}")
            raise
    
    def delete_equipment(self, equipment_id: int) -> bool:
        """
        Delete an equipment entry.
        
        Args:
            equipment_id: The equipment ID to delete
            
        Returns:
            True if deletion was successful, False otherwise
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("DELETE FROM equipment WHERE id = ?", (equipment_id,))
            self.conn.commit()
            
            # Log mutation for mesh sync
            self._log_mutation('equipment', 'DELETE', {'_record_id': equipment_id}, equipment_id)
            
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error deleting equipment: {e}")
            raise
    
    # R&D Logs CRUD Operations
    
    def add_rd_log(self, project_name: str, log_title: str, log_text: str,
                   cloud_file_url: Optional[str] = None,
                   is_downloaded_locally: bool = False,
                   project_id: Optional[int] = None,
                   stage_id: Optional[int] = None,
                   outcome: str = 'PENDING',
                   expected_outcome: Optional[str] = None,
                   actual_outcome: Optional[str] = None,
                   findings: Optional[str] = None,
                   conclusion: Optional[str] = None) -> int:
        """
        Add a new R&D log entry to the database.

        Args:
            project_name: Name of the project
            log_title: Title of the log entry
            log_text: Text content of the log
            cloud_file_url: URL to cloud storage for heavy attachments
            is_downloaded_locally: Whether the heavy attachment is downloaded locally
            project_id: Optional project ID to link the log
            outcome: Experiment result status — PENDING, PASS, or FAIL
            expected_outcome: Expected outcome of the experiment
            actual_outcome: Actual outcome of the experiment
            findings: Ongoing observations/findings during the experiment
            conclusion: Final narrative conclusion of the experiment

        Returns:
            The ID of the inserted log entry
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO rd_logs
                    (project_name, project_id, stage_id, log_title, log_text,
                     cloud_file_url, is_downloaded_locally, outcome, expected_outcome,
                     actual_outcome, findings, conclusion)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (project_name, project_id, stage_id, log_title, log_text,
                   cloud_file_url, int(is_downloaded_locally), outcome.upper(),
                   expected_outcome, actual_outcome, findings, conclusion))
            self.conn.commit()
            
            # Log mutation for mesh sync
            self._log_mutation('rd_logs', 'INSERT', {
                'project_name': project_name,
                'project_id': project_id,
                'stage_id': stage_id,
                'log_title': log_title,
                'log_text': log_text,
                'cloud_file_url': cloud_file_url,
                'is_downloaded_locally': is_downloaded_locally,
                'outcome': outcome.upper(),
                'expected_outcome': expected_outcome,
                'actual_outcome': actual_outcome,
                'findings': findings,
                'conclusion': conclusion
            }, cursor.lastrowid)
            
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding R&D log: {e}")
            raise

    # Usage logging helpers
    def add_usage_log(self, project_id: Optional[int], experiment_id: Optional[int],
                      entity_type: str, entity_id: Optional[int], quantity_used: float = 0,
                      unit: Optional[str] = None, amount_left: Optional[float] = None,
                      post_use_status: Optional[str] = None, notes: Optional[str] = None,
                      user_id: int = 1, auto_update_inventory: bool = True, stage_id: Optional[int] = None) -> int:
        """Add a usage log and optionally update inventory counts/status.

        Returns the inserted usage log ID.
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO usage_logs (project_id, experiment_id, stage_id, entity_type, entity_id,
                                        quantity_used, unit, amount_left, post_use_status,
                                        notes, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (project_id, experiment_id, stage_id, entity_type, entity_id,
                  quantity_used, unit, amount_left, post_use_status, notes, user_id))
            self.conn.commit()
            log_id = cursor.lastrowid

            # Auto-update inventory if requested
            if auto_update_inventory and entity_type and entity_id:
                try:
                    if entity_type == 'component':
                        # decrement components.quantity
                        cursor.execute("SELECT quantity FROM components WHERE id = ?", (entity_id,))
                        row = cursor.fetchone()
                        if row:
                            new_q = max(0, (row['quantity'] or 0) - (quantity_used or 0))
                            cursor.execute("UPDATE components SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?", (new_q, entity_id))
                    elif entity_type == 'tool':
                        cursor.execute("SELECT quantity FROM tools WHERE id = ?", (entity_id,))
                        row = cursor.fetchone()
                        if row:
                            new_q = max(0, (row['quantity'] or 0) - int(quantity_used or 0))
                            cursor.execute("UPDATE tools SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?", (new_q, entity_id))
                    elif entity_type == 'material':
                        cursor.execute("SELECT quantity FROM materials WHERE id = ?", (entity_id,))
                        row = cursor.fetchone()
                        if row:
                            new_q = max(0, (row['quantity'] or 0) - (quantity_used or 0))
                            cursor.execute("UPDATE materials SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?", (new_q, entity_id))
                    elif entity_type == 'equipment' and post_use_status:
                        cursor.execute("UPDATE equipment SET status = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?", (post_use_status, entity_id))
                    self.conn.commit()
                except sqlite3.Error as e:
                    print(f"Error auto-updating inventory for usage log: {e}")

            return log_id
        except sqlite3.Error as e:
            print(f"Error adding usage log: {e}")
            raise

    def get_usage_logs(self, project_id: Optional[int] = None, experiment_id: Optional[int] = None,
                       limit: int = 100, offset: int = 0, stage_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Retrieve usage logs filtered by project or experiment."""
        try:
            cursor = self.conn.cursor()
            query = "SELECT * FROM usage_logs WHERE 1=1"
            params: List[Any] = []
            if project_id:
                query += " AND project_id = ?"
                params.append(project_id)
            if experiment_id:
                query += " AND experiment_id = ?"
                params.append(experiment_id)
            if stage_id:
                query += " AND stage_id = ?"
                params.append(stage_id)
            query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving usage logs: {e}")
            raise

    def update_usage_log(self, usage_id: int, **kwargs) -> bool:
        """Update a usage log entry with allowed fields."""
        try:
            if not kwargs:
                return False
            fields = []
            values = []
            allowed = ['entity_type', 'entity_id', 'quantity_used', 'unit', 'amount_left', 'post_use_status', 'notes', 'user_id', 'stage_id']
            for k, v in kwargs.items():
                if k in allowed:
                    fields.append(f"{k} = ?")
                    values.append(v)
            if not fields:
                return False
            values.append(usage_id)
            query = f"UPDATE usage_logs SET {', '.join(fields)} WHERE id = ?"
            cursor = self.conn.cursor()
            cursor.execute(query, values)
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error updating usage log: {e}")
            raise

    # Experiment stages helpers
    def add_experiment_stage(self, experiment_id: int, stage_name: str, owner: Optional[str] = None,
                             start_time: Optional[str] = None, end_time: Optional[str] = None,
                             status: str = 'not_started', notes: Optional[str] = None,
                             attachments: Optional[str] = None) -> int:
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO experiment_stages (experiment_id, stage_name, owner, start_time, end_time, status, notes, attachments)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (experiment_id, stage_name, owner, start_time, end_time, status, notes, attachments))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding experiment stage: {e}")
            raise

    def get_experiment_stages(self, experiment_id: int, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        try:
            cursor = self.conn.cursor()
            query = "SELECT * FROM experiment_stages WHERE experiment_id = ? AND is_tombstone = 0 ORDER BY created_at LIMIT ? OFFSET ?"
            cursor.execute(query, (experiment_id, limit, offset))
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving experiment stages: {e}")
            raise

    def get_all_experiment_stages(self, limit: int = 200, offset: int = 0) -> List[Dict[str, Any]]:
        try:
            cursor = self.conn.cursor()
            query = "SELECT * FROM experiment_stages WHERE is_tombstone = 0 ORDER BY created_at LIMIT ? OFFSET ?"
            cursor.execute(query, (limit, offset))
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving all experiment stages: {e}")
            raise

    # Project stages helpers
    def add_project_stage(self, project_id: int, stage_name: str, owner: Optional[str] = None,
                          start_time: Optional[str] = None, end_time: Optional[str] = None,
                          status: str = 'not_started', notes: Optional[str] = None,
                          attachments: Optional[str] = None) -> int:
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO project_stages (project_id, stage_name, owner, start_time, end_time, status, notes, attachments)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (project_id, stage_name, owner, start_time, end_time, status, notes, attachments))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding project stage: {e}")
            raise

    def get_project_stages(self, project_id: int, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        try:
            cursor = self.conn.cursor()
            query = "SELECT * FROM project_stages WHERE project_id = ? AND is_tombstone = 0 ORDER BY created_at LIMIT ? OFFSET ?"
            cursor.execute(query, (project_id, limit, offset))
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving project stages: {e}")
            raise

    def get_all_project_stages(self, limit: int = 200, offset: int = 0) -> List[Dict[str, Any]]:
        try:
            cursor = self.conn.cursor()
            query = "SELECT * FROM project_stages WHERE is_tombstone = 0 ORDER BY created_at LIMIT ? OFFSET ?"
            cursor.execute(query, (limit, offset))
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving all project stages: {e}")
            raise

    def _migrate_experiment_stages_table(self, cursor: sqlite3.Cursor) -> None:
        try:
            cursor.execute("PRAGMA table_info(experiment_stages)")
            rows = cursor.fetchall()
            cols = [c[1] for c in rows]
            # Detect whether experiment_id column was NOT NULL in the old schema
            experiment_id_notnull = any((c[1] == 'experiment_id' and c[3] == 1) for c in rows)

            # If project_id column missing or experiment_id was NOT NULL, perform migration
            if 'project_id' in cols or experiment_id_notnull:
                print('[db] Migrating experiment_stages table to separate project and experiment stages...')
                # Rename existing table
                cursor.execute('ALTER TABLE experiment_stages RENAME TO experiment_stages_old')
                # Create new table without project_id (only experiment_id)
                cursor.execute("""
                    CREATE TABLE experiment_stages (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        experiment_id INTEGER NOT NULL,
                        stage_name TEXT NOT NULL,
                        owner TEXT,
                        start_time TIMESTAMP,
                        end_time TIMESTAMP,
                        status TEXT DEFAULT 'not_started',
                        notes TEXT,
                        attachments TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (experiment_id) REFERENCES rd_logs(id) ON DELETE CASCADE
                    )
                """)
                # Copy experiment-level stages (where experiment_id is not NULL)
                cursor.execute("""
                    INSERT INTO experiment_stages (id, experiment_id, stage_name, owner, start_time, end_time, status, notes, attachments, created_at)
                    SELECT id, experiment_id, stage_name, owner, start_time, end_time, status, notes, attachments, created_at
                    FROM experiment_stages_old
                    WHERE experiment_id IS NOT NULL
                """)
                # Move project-level stages (where project_id is not NULL and experiment_id is NULL) to project_stages table
                cursor.execute("""
                    INSERT INTO project_stages (project_id, stage_name, owner, start_time, end_time, status, notes, attachments, created_at)
                    SELECT project_id, stage_name, owner, start_time, end_time, status, notes, attachments, created_at
                    FROM experiment_stages_old
                    WHERE project_id IS NOT NULL AND experiment_id IS NULL
                """)
                cursor.execute('DROP TABLE experiment_stages_old')
                print('[db] Migration complete: project and experiment stages separated')
        except sqlite3.Error as e:
            print(f"[db] Migration warning (experiment_stages): {e}")
            # Do not raise to avoid blocking startup

    def _migrate_usage_logs_table(self, cursor: sqlite3.Cursor) -> None:
        try:
            cursor.execute("PRAGMA table_info(usage_logs)")
            rows = cursor.fetchall()
            cols = [c[1] for c in rows]
            if 'stage_id' not in cols:
                print('[db] Migrating usage_logs to add stage_id column...')
                cursor.execute('ALTER TABLE usage_logs RENAME TO usage_logs_old')
                cursor.execute('''
                    CREATE TABLE usage_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        project_id INTEGER,
                        experiment_id INTEGER,
                        stage_id INTEGER,
                        entity_type TEXT NOT NULL,
                        entity_id INTEGER,
                        quantity_used REAL DEFAULT 0,
                        unit TEXT,
                        amount_left REAL,
                        post_use_status TEXT,
                        notes TEXT,
                        user_id INTEGER DEFAULT 1,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
                        FOREIGN KEY (stage_id) REFERENCES experiment_stages(id) ON DELETE SET NULL
                    )
                ''')
                cursor.execute('''
                    INSERT INTO usage_logs (id, project_id, experiment_id, stage_id, entity_type, entity_id, quantity_used, unit, amount_left, post_use_status, notes, user_id, timestamp)
                    SELECT id, project_id, experiment_id, NULL, entity_type, entity_id, quantity_used, unit, amount_left, post_use_status, notes, user_id, timestamp
                    FROM usage_logs_old
                ''')
                cursor.execute('DROP TABLE usage_logs_old')
                print('[db] Migration complete: usage_logs updated')
        except sqlite3.Error as e:
            print(f"[db] Migration warning (usage_logs): {e}")

    def _migrate_projects_rename_summary_findings(self, cursor: sqlite3.Cursor) -> None:
        """Rename summary_findings column to project_outcome on projects table."""
        try:
            cursor.execute("PRAGMA table_info(projects)")
            cols = [c[1] for c in cursor.fetchall()]
            if 'project_outcome' not in cols and 'summary_findings' in cols:
                print("[db] Migrating projects: renaming summary_findings -> project_outcome...")
                cursor.execute("ALTER TABLE projects ADD COLUMN project_outcome TEXT")
                cursor.execute("UPDATE projects SET project_outcome = summary_findings WHERE summary_findings IS NOT NULL")
                print("[db] Migration complete: project_outcome column added and populated")
            elif 'project_outcome' not in cols:
                print("[db] Migrating projects: adding project_outcome column...")
                cursor.execute("ALTER TABLE projects ADD COLUMN project_outcome TEXT")
                print("[db] Migration complete: project_outcome column added")
            else:
                print("[db] projects table already has project_outcome column")
        except sqlite3.Error as e:
            print(f"[db] Migration warning (project_outcome): {e}")

    def _migrate_rd_logs_add_conclusion(self, cursor: sqlite3.Cursor) -> None:
        """Add conclusion column to rd_logs for the final experiment narrative."""
        try:
            cursor.execute("PRAGMA table_info(rd_logs)")
            cols = [c[1] for c in cursor.fetchall()]
            if 'conclusion' not in cols:
                print("[db] Migrating rd_logs: adding conclusion column...")
                cursor.execute("ALTER TABLE rd_logs ADD COLUMN conclusion TEXT")
                print("[db] Migration complete: conclusion column added to rd_logs")
            else:
                print("[db] rd_logs already has conclusion column")
        except sqlite3.Error as e:
            print(f"[db] Migration warning (conclusion): {e}")

    def _migrate_findings_add_stage_id(self, cursor: sqlite3.Cursor) -> None:
        """Add stage_id FK to findings so findings can be scoped to an experiment stage."""
        try:
            cursor.execute("PRAGMA table_info(findings)")
            cols = [c[1] for c in cursor.fetchall()]
            if 'stage_id' not in cols:
                print("[db] Migrating findings: adding stage_id column...")
                cursor.execute("ALTER TABLE findings ADD COLUMN stage_id INTEGER")
                try:
                    cursor.execute("CREATE INDEX IF NOT EXISTS idx_findings_stage ON findings(stage_id)")
                except sqlite3.Error:
                    pass
                print("[db] Migration complete: stage_id added to findings")
            else:
                print("[db] findings already has stage_id column")
        except sqlite3.Error as e:
            print(f"[db] Migration warning (findings stage_id): {e}")

    def _migrate_knowledge_vault_add_exp_stage(self, cursor: sqlite3.Cursor) -> None:
        """Add experiment_id and stage_id to knowledge_vault for tighter scoping."""
        try:
            cursor.execute("PRAGMA table_info(knowledge_vault)")
            cols = [c[1] for c in cursor.fetchall()]
            if 'experiment_id' not in cols:
                print("[db] Migrating knowledge_vault: adding experiment_id column...")
                cursor.execute("ALTER TABLE knowledge_vault ADD COLUMN experiment_id INTEGER")
                print("[db] Migration complete: experiment_id added to knowledge_vault")
            else:
                print("[db] knowledge_vault already has experiment_id column")
            if 'stage_id' not in cols:
                print("[db] Migrating knowledge_vault: adding stage_id column...")
                cursor.execute("ALTER TABLE knowledge_vault ADD COLUMN stage_id INTEGER")
                try:
                    cursor.execute("CREATE INDEX IF NOT EXISTS idx_kv_experiment ON knowledge_vault(experiment_id)")
                    cursor.execute("CREATE INDEX IF NOT EXISTS idx_kv_stage ON knowledge_vault(stage_id)")
                except sqlite3.Error:
                    pass
                print("[db] Migration complete: stage_id added to knowledge_vault")
            else:
                print("[db] knowledge_vault already has stage_id column")
        except sqlite3.Error as e:
            print(f"[db] Migration warning (knowledge_vault exp/stage): {e}")

    # Note: `get_all_experiment_stages` with `limit`/`offset` is defined earlier
    # to support server-side pagination. Do not redefine it here.

    def update_experiment_stage(self, stage_id: int, **kwargs) -> bool:
        try:
            if not kwargs:
                return False
            fields = []
            values = []
            allowed = ['stage_name','owner','start_time','end_time','status','notes','attachments']
            for k, v in kwargs.items():
                if k in allowed:
                    fields.append(f"{k} = ?")
                    values.append(v)
            if not fields:
                return False
            values.append(stage_id)
            query = f"UPDATE experiment_stages SET {', '.join(fields)} WHERE id = ?"
            cursor = self.conn.cursor()
            cursor.execute(query, values)
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error updating experiment stage: {e}")
            raise

    def update_project_stage(self, stage_id: int, **kwargs) -> bool:
        try:
            if not kwargs:
                return False
            fields = []
            values = []
            allowed = ['stage_name','owner','start_time','end_time','status','notes','attachments']
            for k, v in kwargs.items():
                if k in allowed:
                    fields.append(f"{k} = ?")
                    values.append(v)
            if not fields:
                return False
            values.append(stage_id)
            query = f"UPDATE project_stages SET {', '.join(fields)} WHERE id = ?"
            cursor = self.conn.cursor()
            cursor.execute(query, values)
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error updating project stage: {e}")
            raise
    
    def delete_project_stage(self, stage_id: int) -> bool:
        """Delete a project stage by marking it as tombstone."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("UPDATE project_stages SET is_tombstone = 1 WHERE id = ?", (stage_id,))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error deleting project stage: {e}")
            raise
    
    def get_rd_log(self, log_id: int) -> Optional[Dict[str, Any]]:
        """
        Retrieve a single R&D log entry by ID.
        
        Args:
            log_id: The log ID to retrieve
            
        Returns:
            Dictionary containing log data or None if not found
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT * FROM rd_logs WHERE id = ? AND is_tombstone = 0", (log_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.Error as e:
            print(f"Error retrieving R&D log: {e}")
            raise
    
    def get_all_rd_logs(self, project_name: Optional[str] = None,
                        project_id: Optional[int] = None,
                        stage_id: Optional[int] = None,
                        outcome: Optional[str] = None,
                        start_date: Optional[str] = None,
                        end_date: Optional[str] = None,
                        limit: int = 200, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Retrieve R&D log entries, optionally filtered by project, outcome, or date range.

        Args:
            project_name: Optional project name filter
            project_id: Optional project ID filter (takes priority over project_name)
            outcome: Optional outcome filter (PENDING, PASS, FAIL)
            start_date: Optional start date filter (ISO format string)
            end_date: Optional end date filter (ISO format string)
            limit: Maximum number of records to return
            offset: Number of records to skip

        Returns:
            List of dictionaries containing log data
        """
        try:
            cursor = self.conn.cursor()
            
            # Build WHERE clause dynamically
            conditions = ["is_tombstone = 0"]
            params = []
            
            if project_id is not None:
                conditions.append("project_id = ?")
                params.append(project_id)
            elif project_name:
                conditions.append("project_name = ?")
                params.append(project_name)
            
            if outcome:
                conditions.append("outcome = ?")
                params.append(outcome.upper())

            if stage_id is not None:
                conditions.append("stage_id = ?")
                params.append(stage_id)
            
            if start_date:
                conditions.append("timestamp >= ?")
                params.append(start_date)
            
            if end_date:
                conditions.append("timestamp <= ?")
                params.append(end_date)
            
            # Build query
            query = "SELECT * FROM rd_logs"
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
            query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving R&D logs: {e}")
            raise
    
    def update_rd_log(self, log_id: int, **kwargs) -> bool:
        """
        Update R&D log fields.
        
        Args:
            log_id: The log ID to update
            **kwargs: Fields to update (project_name, log_title, log_text,
                      cloud_file_url, is_downloaded_locally, conclusion, etc.)
            
        Returns:
            True if update was successful, False otherwise
        """
        try:
            if not kwargs:
                return False
            
            # Build dynamic update query
            fields = []
            values = []
            allowed_text = [
                'project_name', 'project_id', 'log_title', 'log_text', 'cloud_file_url',
                'outcome', 'stage_id', 'expected_outcome', 'actual_outcome', 'findings',
                'outcome_attachments', 'findings_attachments', 'conclusion', 'status'
            ]
            for key, value in kwargs.items():
                if key in allowed_text:
                    fields.append(f"{key} = ?")
                    values.append(value.upper() if key == 'outcome' else value)
                elif key == 'is_downloaded_locally':
                    fields.append("is_downloaded_locally = ?")
                    values.append(int(value))
            
            if not fields:
                return False
            
            values.append(log_id)
            query = f"UPDATE rd_logs SET {', '.join(fields)} WHERE id = ?"
            cursor = self.conn.cursor()
            cursor.execute(query, values)
            self.conn.commit()
            
            # Log mutation for mesh sync
            self._log_mutation('rd_logs', 'UPDATE', kwargs, log_id)
            
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error updating R&D log: {e}")
            raise
    
    def mark_file_downloaded(self, log_id: int) -> bool:
        """
        Mark a heavy attachment as downloaded locally.
        
        Args:
            log_id: The log ID to update
            
        Returns:
            True if update was successful, False otherwise
        """
        return self.update_rd_log(log_id, is_downloaded_locally=True)
    
    def delete_rd_log(self, log_id: int) -> bool:
        """
        Delete an R&D log entry.
        
        Args:
            log_id: The log ID to delete
            
        Returns:
            True if deletion was successful, False otherwise
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("DELETE FROM rd_logs WHERE id = ?", (log_id,))
            self.conn.commit()
            
            # Log mutation for mesh sync
            self._log_mutation('rd_logs', 'DELETE', {'_record_id': log_id}, log_id)
            
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error deleting R&D log: {e}")
            raise
    
    # Project CRUD Operations
    
    def add_project(self, name: str, description: Optional[str] = None, 
                   status: str = "Active", start_date: Optional[str] = None,
                   summary_findings: Optional[str] = None,
                   project_outcome: Optional[str] = None) -> int:
        """
        Add a new project to the database.
        
        Args:
            name: Project name (must be unique)
            description: Project description
            status: Project status (Active, Completed, Paused)
            start_date: Project start date (ISO format string)
            summary_findings: Legacy field (kept for compat)
            project_outcome: The final outcome / conclusion of the project
            
        Returns:
            The ID of the inserted project
            
        Raises:
            sqlite3.IntegrityError: If project name already exists
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO projects (name, description, status, start_date, project_outcome)
                VALUES (?, ?, ?, ?, ?)
            """, (name, description, status, start_date, project_outcome or summary_findings))
            self.conn.commit()
            
            # Log mutation for mesh sync
            self._log_mutation('projects', 'INSERT', {
                'name': name,
                'description': description,
                'status': status,
                'start_date': start_date,
                'project_outcome': project_outcome or summary_findings
            }, cursor.lastrowid)
            
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            print(f"[db] Project '{name}' already exists")
            raise
        except sqlite3.Error as e:
            print(f"Error adding project: {e}")
            raise
    
    def get_project(self, project_id: int) -> Optional[Dict[str, Any]]:
        """
        Retrieve a single project by ID.
        
        Args:
            project_id: The project ID to retrieve
            
        Returns:
            Dictionary containing project data or None if not found
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT * FROM projects WHERE id = ? AND is_tombstone = 0", (project_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.Error as e:
            print(f"Error retrieving project: {e}")
            raise
    
    def get_project_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a single project by name.
        
        Args:
            name: The project name to retrieve
            
        Returns:
            Dictionary containing project data or None if not found
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT * FROM projects WHERE name = ? AND is_tombstone = 0", (name,))
            row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.Error as e:
            print(f"Error retrieving project by name: {e}")
            raise
    
    def get_all_projects(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Retrieve all projects, optionally filtered by status.
        
        Args:
            status: Optional status filter (Active, Completed, Paused)
            
        Returns:
            List of dictionaries containing project data
        """
        try:
            cursor = self.conn.cursor()
            if status:
                cursor.execute("""
                    SELECT * FROM projects 
                    WHERE status = ? AND is_tombstone = 0
                    ORDER BY created_at DESC
                """, (status,))
            else:
                cursor.execute("SELECT * FROM projects WHERE is_tombstone = 0 ORDER BY created_at DESC")
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving all projects: {e}")
            raise
    
    def update_project(self, project_id: int, **kwargs) -> bool:
        """
        Update project fields.
        
        Args:
            project_id: The project ID to update
            **kwargs: Fields to update (name, description, status, start_date,
                      project_outcome, summary_findings[legacy])
            
        Returns:
            True if update was successful, False otherwise
        """
        try:
            if not kwargs:
                return False
            
            fields = []
            values = []
            allowed = ['name', 'description', 'status', 'start_date', 'project_outcome', 'summary_findings']
            for key, value in kwargs.items():
                if key in allowed:
                    # Transparently map legacy summary_findings to project_outcome
                    col = 'project_outcome' if key == 'summary_findings' else key
                    fields.append(f"{col} = ?")
                    values.append(value)
            
            if not fields:
                return False
            
            values.append(project_id)
            query = f"UPDATE projects SET {', '.join(fields)} WHERE id = ?"
            cursor = self.conn.cursor()
            cursor.execute(query, values)
            self.conn.commit()
            
            # Log mutation for mesh sync
            self._log_mutation('projects', 'UPDATE', kwargs, project_id)
            
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error updating project: {e}")
            raise
    
    def delete_project(self, project_id: int) -> bool:
        """
        Delete a project and all associated logs.
        
        Args:
            project_id: The project ID to delete
            
        Returns:
            True if deletion was successful, False otherwise
        """
        try:
            cursor = self.conn.cursor()
            # Delete associated logs first (foreign key will handle this with ON DELETE SET NULL)
            cursor.execute("DELETE FROM rd_logs WHERE project_id = ?", (project_id,))
            # Delete the project
            cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
            self.conn.commit()
            
            # Log mutation for mesh sync
            self._log_mutation('projects', 'DELETE', {'_record_id': project_id}, project_id)
            
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error deleting project: {e}")
            raise
    
    def link_log_to_project(self, log_id: int, project_id: int) -> bool:
        """
        Link an existing log to a project.
        
        Args:
            log_id: The log ID to link
            project_id: The project ID to link to
            
        Returns:
            True if update was successful, False otherwise
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                UPDATE rd_logs 
                SET project_id = ?,
                    project_name = (SELECT name FROM projects WHERE id = ?)
                WHERE id = ?
            """, (project_id, project_id, log_id))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error linking log to project: {e}")
            raise
    
    def get_project_usage_summary(self, project_id: int) -> List[Dict[str, Any]]:
        """
        Get deduplicated and summed resource usage for a project.
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                SELECT entity_type, entity_id, SUM(quantity_used) as total_quantity, unit, MAX(timestamp) as last_used
                FROM usage_logs
                WHERE project_id = ?
                GROUP BY entity_type, entity_id, unit
            """, (project_id,))
            rows = cursor.fetchall()
            summary = []
            for r in rows:
                item = dict(r)
                item['name'] = f"Unknown {item['entity_type']} #{item['entity_id']}"
                item['details'] = ""
                # Fetch human-readable name based on type
                if item['entity_type'] == 'tool':
                    cursor.execute("SELECT name, description FROM tools WHERE id = ?", (item['entity_id'],))
                    res = cursor.fetchone()
                    if res:
                        item['name'] = res['name']
                        item['details'] = res['description'] or ""
                elif item['entity_type'] == 'material':
                    cursor.execute("SELECT name, formula FROM materials WHERE id = ?", (item['entity_id'],))
                    res = cursor.fetchone()
                    if res:
                        item['name'] = res['name']
                        item['details'] = res['formula'] or ""
                elif item['entity_type'] == 'equipment':
                    cursor.execute("SELECT name, model FROM equipment WHERE id = ?", (item['entity_id'],))
                    res = cursor.fetchone()
                    if res:
                        item['name'] = res['name']
                        item['details'] = res['model'] or ""
                elif item['entity_type'] == 'component':
                    cursor.execute("SELECT name, part_number FROM components WHERE id = ?", (item['entity_id'],))
                    res = cursor.fetchone()
                    if res:
                        item['name'] = res['name']
                        item['details'] = res['part_number'] or ""
                summary.append(item)
            return summary
        except sqlite3.Error as e:
            print(f"Error getting project usage summary: {e}")
            raise

    def get_experiment_usage_summary(self, experiment_id: int) -> List[Dict[str, Any]]:
        """
        Get deduplicated and summed resource usage for an experiment.
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                SELECT entity_type, entity_id, SUM(quantity_used) as total_quantity, unit, MAX(timestamp) as last_used
                FROM usage_logs
                WHERE experiment_id = ?
                GROUP BY entity_type, entity_id, unit
            """, (experiment_id,))
            rows = cursor.fetchall()
            summary = []
            for r in rows:
                item = dict(r)
                item['name'] = f"Unknown {item['entity_type']} #{item['entity_id']}"
                item['details'] = ""
                # Fetch human-readable name based on type
                if item['entity_type'] == 'tool':
                    cursor.execute("SELECT name, description FROM tools WHERE id = ?", (item['entity_id'],))
                    res = cursor.fetchone()
                    if res:
                        item['name'] = res['name']
                        item['details'] = res['description'] or ""
                elif item['entity_type'] == 'material':
                    cursor.execute("SELECT name, formula FROM materials WHERE id = ?", (item['entity_id'],))
                    res = cursor.fetchone()
                    if res:
                        item['name'] = res['name']
                        item['details'] = res['formula'] or ""
                elif item['entity_type'] == 'equipment':
                    cursor.execute("SELECT name, model FROM equipment WHERE id = ?", (item['entity_id'],))
                    res = cursor.fetchone()
                    if res:
                        item['name'] = res['name']
                        item['details'] = res['model'] or ""
                elif item['entity_type'] == 'component':
                    cursor.execute("SELECT name, part_number FROM components WHERE id = ?", (item['entity_id'],))
                    res = cursor.fetchone()
                    if res:
                        item['name'] = res['name']
                        item['details'] = res['part_number'] or ""
                summary.append(item)
            return summary
        except sqlite3.Error as e:
            print(f"Error getting experiment usage summary: {e}")
            raise
        # Knowledge Vault CRUD Operations
    
    def add_document(self, title: str, file_path: str, file_type: str,
                     file_size: Optional[int] = None, description: Optional[str] = None,
                     metadata: Optional[str] = None, tags: Optional[str] = None,
                     project_id: Optional[int] = None, component_id: Optional[int] = None,
                     equipment_id: Optional[int] = None, experiment_id: Optional[int] = None,
                     stage_id: Optional[int] = None) -> int:
        """
        Add a document to the knowledge vault.
        
        Args:
            title: Document title
            file_path: Path to the file
            file_type: File type (pdf, image, etc.)
            file_size: File size in bytes
            description: Document description
            metadata: JSON metadata
            tags: Comma-separated tags
            project_id: Associated project ID
            component_id: Associated component ID
            equipment_id: Associated equipment ID
            experiment_id: Associated experiment ID
            stage_id: Associated experiment stage ID
            
        Returns:
            The ID of the inserted document
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO knowledge_vault (title, file_path, file_type, file_size, 
                                           description, metadata, tags, project_id, 
                                           component_id, equipment_id, experiment_id, stage_id,
                                           cloud_file_url, is_synced)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0)
            """, (title, file_path, file_type, file_size, description, metadata, 
                  tags, project_id, component_id, equipment_id, experiment_id, stage_id))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding document: {e}")
            raise
    
    def get_document(self, doc_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve a document by ID."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT * FROM knowledge_vault WHERE id = ? AND is_tombstone = 0", (doc_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.Error as e:
            print(f"Error retrieving document: {e}")
            raise
    
    def get_all_documents(self, project_id: Optional[int] = None,
                          file_type: Optional[str] = None,
                          experiment_id: Optional[int] = None,
                          stage_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Retrieve all documents, optionally filtered."""
        try:
            cursor = self.conn.cursor()
            query = "SELECT * FROM knowledge_vault WHERE is_tombstone = 0"
            params = []
            
            if project_id:
                query += " AND project_id = ?"
                params.append(project_id)
            if file_type:
                query += " AND file_type = ?"
                params.append(file_type)
            if experiment_id:
                query += " AND experiment_id = ?"
                params.append(experiment_id)
            if stage_id:
                query += " AND stage_id = ?"
                params.append(stage_id)
            
            query += " ORDER BY upload_date DESC"
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving documents: {e}")
            raise
    
    def update_document_accessed(self, doc_id: int) -> bool:
        """Update last accessed timestamp."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                UPDATE knowledge_vault 
                SET last_accessed = CURRENT_TIMESTAMP 
                WHERE id = ?
            """, (doc_id,))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error updating document access: {e}")
            raise
    
    def delete_document(self, doc_id: int) -> bool:
        """Delete a document."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("UPDATE knowledge_vault SET is_tombstone = 1 WHERE id = ?", (doc_id,))
            self.conn.commit()
            
            # Log mutation for mesh sync
            self._log_mutation('knowledge_vault', 'UPDATE', {'id': doc_id, 'is_tombstone': 1}, doc_id)
            
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error deleting document: {e}")
            raise
    
    # Notebook CRUD Operations
    
    def add_notebook_entry(self, title: str, content: str, entry_type: str = "text",
                          project_id: Optional[int] = None, experiment_id: Optional[int] = None,
                          tags: Optional[str] = None, attachments: Optional[str] = None,
                          voice_transcription: Optional[str] = None) -> int:
        """
        Add a notebook entry.
        
        Args:
            title: Entry title
            content: Entry content
            entry_type: Type of entry (text, voice, image, etc.)
            project_id: Associated project ID
            experiment_id: Associated experiment ID
            tags: Comma-separated tags
            attachments: JSON array of attachment paths
            voice_transcription: Transcribed voice text
            
        Returns:
            The ID of the inserted entry
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO notebook_entries (title, content, entry_type, project_id,
                                             experiment_id, tags, attachments, voice_transcription)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (title, content, entry_type, project_id, experiment_id, 
                  tags, attachments, voice_transcription))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding notebook entry: {e}")
            raise
    
    def get_notebook_entry(self, entry_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve a notebook entry by ID."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT * FROM notebook_entries WHERE id = ?", (entry_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.Error as e:
            print(f"Error retrieving notebook entry: {e}")
            raise
    
    def get_all_notebook_entries(self, project_id: Optional[int] = None,
                                experiment_id: Optional[int] = None,
                                limit: int = 100) -> List[Dict[str, Any]]:
        """Retrieve notebook entries, optionally filtered."""
        try:
            cursor = self.conn.cursor()
            if project_id and experiment_id:
                cursor.execute("""
                    SELECT * FROM notebook_entries 
                    WHERE project_id = ? AND experiment_id = ?
                    ORDER BY created_at DESC 
                    LIMIT ?
                """, (project_id, experiment_id, limit))
            elif project_id:
                cursor.execute("""
                    SELECT * FROM notebook_entries 
                    WHERE project_id = ? 
                    ORDER BY created_at DESC 
                    LIMIT ?
                """, (project_id, limit))
            elif experiment_id:
                cursor.execute("""
                    SELECT * FROM notebook_entries 
                    WHERE experiment_id = ? 
                    ORDER BY created_at DESC 
                    LIMIT ?
                """, (experiment_id, limit))
            else:
                cursor.execute("""
                    SELECT * FROM notebook_entries 
                    ORDER BY created_at DESC 
                    LIMIT ?
                """, (limit,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving notebook entries: {e}")
            raise
    
    def update_notebook_entry(self, entry_id: int, **kwargs) -> bool:
        """Update notebook entry fields."""
        try:
            if not kwargs:
                return False
            
            fields = []
            values = []
            for key, value in kwargs.items():
                if key in ['title', 'content', 'entry_type', 'tags', 'attachments', 'voice_transcription']:
                    fields.append(f"{key} = ?")
                    values.append(value)
            
            if not fields:
                return False
            
            fields.append("updated_at = CURRENT_TIMESTAMP")
            values.append(entry_id)
            
            query = f"UPDATE notebook_entries SET {', '.join(fields)} WHERE id = ?"
            cursor = self.conn.cursor()
            cursor.execute(query, values)
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error updating notebook entry: {e}")
            raise
    
    def delete_notebook_entry(self, entry_id: int) -> bool:
        """Delete a notebook entry."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("DELETE FROM notebook_entries WHERE id = ?", (entry_id,))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error deleting notebook entry: {e}")
            raise
    
    # Components CRUD Operations
    
    def add_component(self, name: str, part_number: Optional[str] = None,
                     description: Optional[str] = None, quantity: int = 0,
                     min_quantity: int = 5, storage_location: Optional[str] = None,
                     datasheet: Optional[str] = None, supplier: Optional[str] = None,
                     supplier_part_number: Optional[str] = None, notes: Optional[str] = None) -> int:
        """
        Add a component to inventory.
        
        Args:
            name: Component name
            part_number: Unique part number
            description: Component description
            quantity: Current quantity
            min_quantity: Minimum quantity threshold
            storage_location: Storage location
            datasheet: Path to datasheet
            supplier: Supplier name
            supplier_part_number: Supplier's part number
            notes: Additional notes
            
        Returns:
            The ID of the inserted component
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO components (name, part_number, description, quantity, min_quantity,
                                       storage_location, datasheet, supplier, supplier_part_number, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (name, part_number, description, quantity, min_quantity, 
                  storage_location, datasheet, supplier, supplier_part_number, notes))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding component: {e}")
            raise
    
    def get_component(self, component_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve a component by ID."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT * FROM components WHERE id = ?", (component_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.Error as e:
            print(f"Error retrieving component: {e}")
            raise
    
    def get_component_by_part_number(self, part_number: str) -> Optional[Dict[str, Any]]:
        """Retrieve a component by part number."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT * FROM components WHERE part_number = ?", (part_number,))
            row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.Error as e:
            print(f"Error retrieving component by part number: {e}")
            raise
    
    def get_all_components(self, low_stock_only: bool = False) -> List[Dict[str, Any]]:
        """Retrieve all components, optionally filtering for low stock."""
        try:
            cursor = self.conn.cursor()
            if low_stock_only:
                cursor.execute("""
                    SELECT * FROM components 
                    WHERE quantity <= min_quantity 
                    ORDER BY quantity ASC
                """)
            else:
                cursor.execute("SELECT * FROM components ORDER BY name")
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving components: {e}")
            raise
    
    def update_component(self, component_id: int, **kwargs) -> bool:
        """Update component fields."""
        try:
            if not kwargs:
                return False
            
            fields = []
            values = []
            for key, value in kwargs.items():
                if key in ['name', 'part_number', 'description', 'quantity', 'min_quantity',
                          'storage_location', 'datasheet', 'supplier', 'supplier_part_number', 'notes']:
                    fields.append(f"{key} = ?")
                    values.append(value)
            
            if not fields:
                return False
            
            fields.append("last_updated = CURRENT_TIMESTAMP")
            values.append(component_id)
            
            query = f"UPDATE components SET {', '.join(fields)} WHERE id = ?"
            cursor = self.conn.cursor()
            cursor.execute(query, values)
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error updating component: {e}")
            raise
    
    def adjust_component_quantity(self, component_id: int, delta: int) -> bool:
        """Adjust component quantity by delta (positive or negative)."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                UPDATE components 
                SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP 
                WHERE id = ?
            """, (delta, component_id))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error adjusting component quantity: {e}")
            raise
    
    def delete_component(self, component_id: int) -> bool:
        """Delete a component."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("DELETE FROM components WHERE id = ?", (component_id,))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error deleting component: {e}")
            raise
    
    # Equipment Maintenance CRUD Operations
    
    def add_maintenance_record(self, equipment_id: int, maintenance_type: str,
                             description: Optional[str] = None, performed_date: Optional[str] = None,
                             next_due_date: Optional[str] = None, performed_by: Optional[str] = None,
                             notes: Optional[str] = None) -> int:
        """
        Add a maintenance record.
        
        Args:
            equipment_id: Equipment ID
            maintenance_type: Type of maintenance (calibration, repair, inspection)
            description: Description of work performed
            performed_date: Date performed (ISO format)
            next_due_date: Next due date (ISO format)
            performed_by: Who performed the maintenance
            notes: Additional notes
            
        Returns:
            The ID of the inserted record
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO equipment_maintenance (equipment_id, maintenance_type, description,
                                                  performed_date, next_due_date, performed_by, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (equipment_id, maintenance_type, description, performed_date, 
                  next_due_date, performed_by, notes))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding maintenance record: {e}")
            raise
    
    def get_maintenance_records(self, equipment_id: Optional[int] = None,
                               due_soon: bool = False) -> List[Dict[str, Any]]:
        """Retrieve maintenance records, optionally filtered."""
        try:
            cursor = self.conn.cursor()
            if equipment_id:
                cursor.execute("""
                    SELECT * FROM equipment_maintenance 
                    WHERE equipment_id = ? 
                    ORDER BY performed_date DESC
                """, (equipment_id,))
            elif due_soon:
                cursor.execute("""
                    SELECT * FROM equipment_maintenance 
                    WHERE next_due_date >= date('now') 
                    AND next_due_date <= date('now', '+30 days')
                    ORDER BY next_due_date ASC
                """)
            else:
                cursor.execute("SELECT * FROM equipment_maintenance ORDER BY performed_date DESC")
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving maintenance records: {e}")
            raise
    
    def update_maintenance_record(self, record_id: int, **kwargs) -> bool:
        """Update maintenance record fields."""
        try:
            if not kwargs:
                return False
            
            fields = []
            values = []
            for key, value in kwargs.items():
                if key in ['maintenance_type', 'description', 'performed_date', 
                          'next_due_date', 'performed_by', 'notes']:
                    fields.append(f"{key} = ?")
                    values.append(value)
            
            if not fields:
                return False
            
            values.append(record_id)
            query = f"UPDATE equipment_maintenance SET {', '.join(fields)} WHERE id = ?"
            cursor = self.conn.cursor()
            cursor.execute(query, values)
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error updating maintenance record: {e}")
            raise
    
    def delete_maintenance_record(self, record_id: int) -> bool:
        """Delete a maintenance record."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("DELETE FROM equipment_maintenance WHERE id = ?", (record_id,))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error deleting maintenance record: {e}")
            raise
    
    # Findings CRUD Operations
    
    def add_finding(self, title: str, finding_type: str, description: str,
                   root_cause: Optional[str] = None, solution: Optional[str] = None,
                   recommendations: Optional[str] = None, project_id: Optional[int] = None,
                   experiment_id: Optional[int] = None, severity: str = "medium",
                   status: str = "open", stage_id: Optional[int] = None) -> int:
        """
        Add a finding or lesson learned.
        
        Args:
            title: Finding title
            finding_type: Type (discovery, problem, lesson, etc.)
            description: Detailed description
            root_cause: Root cause analysis
            solution: Solution implemented
            recommendations: Recommendations for future
            project_id: Associated project ID
            experiment_id: Associated experiment ID
            severity: Severity level (low, medium, high, critical)
            status: Status (open, in_progress, resolved)
            stage_id: Associated experiment stage ID
            
        Returns:
            The ID of the inserted finding
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO findings (title, finding_type, description, root_cause, solution,
                                    recommendations, project_id, experiment_id, severity, status, stage_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (title, finding_type, description, root_cause, solution, 
                  recommendations, project_id, experiment_id, severity, status, stage_id))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding finding: {e}")
            raise
    
    def get_finding(self, finding_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve a finding by ID."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT * FROM findings WHERE id = ? AND is_tombstone = 0", (finding_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.Error as e:
            print(f"Error retrieving finding: {e}")
            raise
    
    def get_all_findings(self, project_id: Optional[int] = None, status: Optional[str] = None,
                        severity: Optional[str] = None, experiment_id: Optional[int] = None,
                        stage_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Retrieve findings, optionally filtered."""
        try:
            cursor = self.conn.cursor()
            query = "SELECT * FROM findings WHERE is_tombstone = 0"
            params = []
            
            if project_id:
                query += " AND project_id = ?"
                params.append(project_id)
            if status:
                query += " AND status = ?"
                params.append(status)
            if severity:
                query += " AND severity = ?"
                params.append(severity)
            if experiment_id:
                query += " AND experiment_id = ?"
                params.append(experiment_id)
            if stage_id:
                query += " AND stage_id = ?"
                params.append(stage_id)
            
            query += " ORDER BY created_at DESC"
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving findings: {e}")
            raise
    
    def update_finding(self, finding_id: int, **kwargs) -> bool:
        """Update finding fields."""
        try:
            if not kwargs:
                return False
            
            fields = []
            values = []
            allowed = ['title', 'finding_type', 'description', 'root_cause', 
                      'solution', 'recommendations', 'severity', 'status', 'project_id', 'experiment_id', 'stage_id']
            for key, value in kwargs.items():
                if key in allowed:
                    fields.append(f"{key} = ?")
                    values.append(value)
                elif key == 'resolved' and value:
                    fields.append("status = 'resolved'")
                    fields.append("resolved_at = CURRENT_TIMESTAMP")
            
            if not fields:
                return False
            
            values.append(finding_id)
            query = f"UPDATE findings SET {', '.join(fields)} WHERE id = ?"
            cursor = self.conn.cursor()
            cursor.execute(query, values)
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error updating finding: {e}")
            raise
    
    def delete_finding(self, finding_id: int) -> bool:
        """Delete a finding."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("DELETE FROM findings WHERE id = ?", (finding_id,))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error deleting finding: {e}")
            raise
    
    # Calculations CRUD Operations
    
    def add_calculation(self, title: str, calculation_type: str, input_parameters: str,
                        result: str, formula: Optional[str] = None, project_id: Optional[int] = None,
                        component_id: Optional[int] = None) -> int:
        """
        Add a stored calculation.
        
        Args:
            title: Calculation title
            calculation_type: Type of calculation (ohms_law, voltage_divider, etc.)
            input_parameters: JSON string of input parameters
            result: Calculation result
            formula: Formula used
            project_id: Associated project ID
            component_id: Associated component ID
            
        Returns:
            The ID of the inserted calculation
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO calculations (title, calculation_type, input_parameters, result,
                                        formula, project_id, component_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (title, calculation_type, input_parameters, result, 
                  formula, project_id, component_id))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding calculation: {e}")
            raise
    
    def get_calculation(self, calc_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve a calculation by ID."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT * FROM calculations WHERE id = ?", (calc_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.Error as e:
            print(f"Error retrieving calculation: {e}")
            raise
    
    def get_all_calculations(self, project_id: Optional[int] = None,
                            calculation_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve calculations, optionally filtered."""
        try:
            cursor = self.conn.cursor()
            query = "SELECT * FROM calculations WHERE 1=1"
            params = []
            
            if project_id:
                query += " AND project_id = ?"
                params.append(project_id)
            if calculation_type:
                query += " AND calculation_type = ?"
                params.append(calculation_type)
            
            query += " ORDER BY created_at DESC"
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving calculations: {e}")
            raise
    
    def delete_calculation(self, calc_id: int) -> bool:
        """Delete a calculation."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("DELETE FROM calculations WHERE id = ?", (calc_id,))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error deleting calculation: {e}")
            raise
    
    # Relationships CRUD Operations
    
    def add_relationship(self, source_type: str, source_id: int, target_type: str,
                        target_id: int, relationship_type: str, confidence: float = 1.0) -> int:
        """
        Add a relationship between entities.
        
        Args:
            source_type: Type of source entity (project, component, equipment, etc.)
            source_id: ID of source entity
            target_type: Type of target entity
            target_id: ID of target entity
            relationship_type: Type of relationship (uses, references, related_to, etc.)
            confidence: Confidence score (0.0 to 1.0)
            
        Returns:
            The ID of the inserted relationship
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO relationships 
                (source_type, source_id, target_type, target_id, relationship_type, confidence)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (source_type, source_id, target_type, target_id, relationship_type, confidence))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding relationship: {e}")
            raise
    
    def get_relationships(self, source_type: Optional[str] = None, source_id: Optional[int] = None,
                        target_type: Optional[str] = None, relationship_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve relationships, optionally filtered."""
        try:
            cursor = self.conn.cursor()
            query = "SELECT * FROM relationships WHERE 1=1"
            params = []
            
            if source_type:
                query += " AND source_type = ?"
                params.append(source_type)
            if source_id:
                query += " AND source_id = ?"
                params.append(source_id)
            if target_type:
                query += " AND target_type = ?"
                params.append(target_type)
            if relationship_type:
                query += " AND relationship_type = ?"
                params.append(relationship_type)
            
            query += " ORDER BY confidence DESC"
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving relationships: {e}")
            raise
    
    def delete_relationship(self, source_type: str, source_id: int, target_type: str,
                          target_id: int, relationship_type: str) -> bool:
        """Delete a specific relationship."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                DELETE FROM relationships 
                WHERE source_type = ? AND source_id = ? AND target_type = ? 
                AND target_id = ? AND relationship_type = ?
            """, (source_type, source_id, target_type, target_id, relationship_type))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error deleting relationship: {e}")
            raise
    
    # Component Usage CRUD Operations
    
    def add_component_usage(self, component_id: int, quantity_used: int = 1,
                           project_id: Optional[int] = None, experiment_id: Optional[int] = None,
                           notes: Optional[str] = None) -> int:
        """
        Record component usage.
        
        Args:
            component_id: Component ID
            quantity_used: Quantity used
            project_id: Associated project ID
            experiment_id: Associated experiment ID
            notes: Usage notes
            
        Returns:
            The ID of the inserted usage record
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO component_usage (component_id, quantity_used, project_id, experiment_id, notes)
                VALUES (?, ?, ?, ?, ?)
            """, (component_id, quantity_used, project_id, experiment_id, notes))
            self.conn.commit()
            
            # Automatically adjust component quantity
            self.adjust_component_quantity(component_id, -quantity_used)
            
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding component usage: {e}")
            raise
    
    def get_component_usage(self, component_id: Optional[int] = None,
                          project_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Retrieve component usage records, optionally filtered."""
        try:
            cursor = self.conn.cursor()
            query = "SELECT * FROM component_usage WHERE 1=1"
            params = []
            
            if component_id:
                query += " AND component_id = ?"
                params.append(component_id)
            if project_id:
                query += " AND project_id = ?"
                params.append(project_id)
            
            query += " ORDER BY usage_date DESC"
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving component usage: {e}")
            raise
    
    # Tools CRUD Operations
    
    def add_tool(self, name: str, tool_type: Optional[str] = None,
                description: Optional[str] = None, quantity: int = 1,
                min_quantity: int = 1, storage_location: Optional[str] = None,
                status: str = 'available', purchase_date: Optional[str] = None,
                supplier: Optional[str] = None, notes: Optional[str] = None) -> int:
        """Add a tool to inventory."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO tools (name, tool_type, description, quantity, min_quantity,
                                 storage_location, status, purchase_date, supplier, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (name, tool_type, description, quantity, min_quantity, 
                  storage_location, status, purchase_date, supplier, notes))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding tool: {e}")
            raise
    
    def get_tool(self, tool_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve a tool by ID."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT * FROM tools WHERE id = ?", (tool_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.Error as e:
            print(f"Error retrieving tool: {e}")
            raise
    
    def get_all_tools(self, low_stock_only: bool = False) -> List[Dict[str, Any]]:
        """Retrieve all tools, optionally filtering for low stock."""
        try:
            cursor = self.conn.cursor()
            if low_stock_only:
                cursor.execute("""
                    SELECT * FROM tools 
                    WHERE quantity <= min_quantity 
                    ORDER BY quantity ASC
                """)
            else:
                cursor.execute("SELECT * FROM tools ORDER BY name")
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving tools: {e}")
            raise
    
    def update_tool(self, tool_id: int, **kwargs) -> bool:
        """Update tool fields."""
        try:
            if not kwargs:
                return False
            
            fields = []
            values = []
            for key, value in kwargs.items():
                if key in ['name', 'tool_type', 'description', 'quantity', 'min_quantity',
                          'storage_location', 'status', 'purchase_date', 'supplier', 'notes']:
                    fields.append(f"{key} = ?")
                    values.append(value)
            
            if not fields:
                return False
            
            fields.append("last_updated = CURRENT_TIMESTAMP")
            values.append(tool_id)
            
            query = f"UPDATE tools SET {', '.join(fields)} WHERE id = ?"
            cursor = self.conn.cursor()
            cursor.execute(query, values)
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error updating tool: {e}")
            raise
    
    def adjust_tool_quantity(self, tool_id: int, delta: int) -> bool:
        """Adjust tool quantity by delta (positive or negative)."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                UPDATE tools 
                SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP 
                WHERE id = ?
            """, (delta, tool_id))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error adjusting tool quantity: {e}")
            raise
    
    def delete_tool(self, tool_id: int) -> bool:
        """Delete a tool."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("DELETE FROM tools WHERE id = ?", (tool_id,))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error deleting tool: {e}")
            raise
    
    # Materials CRUD Operations
    
    def add_material(self, name: str, material_type: Optional[str] = None,
                   description: Optional[str] = None, quantity: float = 0,
                   unit: str = 'units', min_quantity: float = 10,
                   storage_location: Optional[str] = None, purchase_date: Optional[str] = None,
                   supplier: Optional[str] = None, notes: Optional[str] = None) -> int:
        """Add a material to inventory."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO materials (name, material_type, description, quantity, unit,
                                     min_quantity, storage_location, purchase_date, supplier, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (name, material_type, description, quantity, unit, 
                  min_quantity, storage_location, purchase_date, supplier, notes))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding material: {e}")
            raise
    
    def get_material(self, material_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve a material by ID."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT * FROM materials WHERE id = ?", (material_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.Error as e:
            print(f"Error retrieving material: {e}")
            raise
    
    def get_all_materials(self, low_stock_only: bool = False) -> List[Dict[str, Any]]:
        """Retrieve all materials, optionally filtering for low stock."""
        try:
            cursor = self.conn.cursor()
            if low_stock_only:
                cursor.execute("""
                    SELECT * FROM materials 
                    WHERE quantity <= min_quantity 
                    ORDER BY quantity ASC
                """)
            else:
                cursor.execute("SELECT * FROM materials ORDER BY name")
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving materials: {e}")
            raise
    
    def update_material(self, material_id: int, **kwargs) -> bool:
        """Update material fields."""
        try:
            if not kwargs:
                return False
            
            fields = []
            values = []
            for key, value in kwargs.items():
                if key in ['name', 'material_type', 'description', 'quantity', 'unit',
                          'min_quantity', 'storage_location', 'purchase_date', 'supplier', 'notes']:
                    fields.append(f"{key} = ?")
                    values.append(value)
            
            if not fields:
                return False
            
            fields.append("last_updated = CURRENT_TIMESTAMP")
            values.append(material_id)
            
            query = f"UPDATE materials SET {', '.join(fields)} WHERE id = ?"
            cursor = self.conn.cursor()
            cursor.execute(query, values)
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error updating material: {e}")
            raise
    
    def adjust_material_quantity(self, material_id: int, delta: float) -> bool:
        """Adjust material quantity by delta (positive or negative)."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                UPDATE materials 
                SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP 
                WHERE id = ?
            """, (delta, material_id))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error adjusting material quantity: {e}")
            raise
    
    def delete_material(self, material_id: int) -> bool:
        """Delete a material."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("DELETE FROM materials WHERE id = ?", (material_id,))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error deleting material: {e}")
            raise
    
    # Equipment Usage CRUD Operations
    
    def add_equipment_usage(self, equipment_id: int, usage_type: str = 'checkout',
                           project_id: Optional[int] = None, experiment_id: Optional[int] = None,
                           used_by: Optional[str] = None, post_use_status: str = 'usable',
                           condition_notes: Optional[str] = None, efficiency_percentage: Optional[float] = None,
                           notes: Optional[str] = None) -> int:
        """Record equipment usage (checkout/checkin)."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO equipment_usage (equipment_id, usage_type, project_id, experiment_id, used_by, 
                                            post_use_status, condition_notes, efficiency_percentage, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (equipment_id, usage_type, project_id, experiment_id, used_by, 
                  post_use_status, condition_notes, efficiency_percentage, notes))
            self.conn.commit()
            
            # Update equipment status based on usage type
            if usage_type == 'checkout':
                self.update_equipment(equipment_id, status='in_use')
            elif usage_type == 'checkin':
                self.update_equipment(equipment_id, status='available')
            
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding equipment usage: {e}")
            raise
    
    def get_equipment_usage(self, equipment_id: Optional[int] = None,
                          project_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Retrieve equipment usage records, optionally filtered."""
        try:
            cursor = self.conn.cursor()
            query = "SELECT * FROM equipment_usage WHERE 1=1"
            params = []
            
            if equipment_id:
                query += " AND equipment_id = ?"
                params.append(equipment_id)
            if project_id:
                query += " AND project_id = ?"
                params.append(project_id)
            
            query += " ORDER BY usage_date DESC"
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving equipment usage: {e}")
            raise
    
    def update_equipment_usage_return(self, usage_id: int, return_date: Optional[str] = None) -> bool:
        """Update equipment usage with return date."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                UPDATE equipment_usage 
                SET return_date = COALESCE(?, CURRENT_TIMESTAMP)
                WHERE id = ?
            """, (return_date, usage_id))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error updating equipment usage return: {e}")
            raise
    
    # Tools Usage CRUD Operations
    
    def add_tool_usage(self, tool_id: int, quantity_used: int = 1, amount_left: int = 0,
                      project_id: Optional[int] = None, experiment_id: Optional[int] = None,
                      post_use_status: str = 'usable', condition_notes: Optional[str] = None,
                      efficiency_percentage: Optional[float] = None, notes: Optional[str] = None) -> int:
        """Record tool usage."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO tool_usage (tool_id, quantity_used, amount_left, project_id, experiment_id,
                                       post_use_status, condition_notes, efficiency_percentage, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (tool_id, quantity_used, amount_left, project_id, experiment_id, 
                  post_use_status, condition_notes, efficiency_percentage, notes))
            self.conn.commit()
            
            # Automatically adjust tool quantity
            self.adjust_tool_quantity(tool_id, -quantity_used)
            
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding tool usage: {e}")
            raise
    
    def get_tool_usage(self, tool_id: Optional[int] = None,
                     project_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Retrieve tool usage records, optionally filtered."""
        try:
            cursor = self.conn.cursor()
            query = "SELECT * FROM tool_usage WHERE 1=1"
            params = []
            
            if tool_id:
                query += " AND tool_id = ?"
                params.append(tool_id)
            if project_id:
                query += " AND project_id = ?"
                params.append(project_id)
            
            query += " ORDER BY usage_date DESC"
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving tool usage: {e}")
            raise
    
    # Materials Usage CRUD Operations
    
    def add_material_usage(self, material_id: int, quantity_used: float, amount_left: float = 0,
                          project_id: Optional[int] = None, experiment_id: Optional[int] = None,
                          post_use_status: str = 'usable', condition_notes: Optional[str] = None,
                          notes: Optional[str] = None) -> int:
        """Record material usage."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO material_usage (material_id, quantity_used, amount_left, project_id, experiment_id,
                                           post_use_status, condition_notes, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (material_id, quantity_used, amount_left, project_id, experiment_id, 
                  post_use_status, condition_notes, notes))
            self.conn.commit()
            
            # Automatically adjust material quantity
            self.adjust_material_quantity(material_id, -quantity_used)
            
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding material usage: {e}")
            raise
    
    def get_material_usage(self, material_id: Optional[int] = None,
                          project_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Retrieve material usage records, optionally filtered."""
        try:
            cursor = self.conn.cursor()
            query = "SELECT * FROM material_usage WHERE 1=1"
            params = []
            
            if material_id:
                query += " AND material_id = ?"
                params.append(material_id)
            if project_id:
                query += " AND project_id = ?"
                params.append(project_id)
            
            query += " ORDER BY usage_date DESC"
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving material usage: {e}")
            raise
    
    # Funding Sources CRUD Operations
    
    def add_funding_source(self, name: str, source_type: str,
                          description: Optional[str] = None, budget_limit: Optional[float] = None,
                          current_balance: float = 0, account_number: Optional[str] = None,
                          contact_person: Optional[str] = None) -> int:
        """Add a funding source."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO funding_sources (name, source_type, description, budget_limit,
                                           current_balance, account_number, contact_person)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (name, source_type, description, budget_limit, 
                  current_balance, account_number, contact_person))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding funding source: {e}")
            raise
    
    def get_funding_source(self, source_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve a funding source by ID."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT * FROM funding_sources WHERE id = ?", (source_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.Error as e:
            print(f"Error retrieving funding source: {e}")
            raise
    
    def get_all_funding_sources(self) -> List[Dict[str, Any]]:
        """Retrieve all funding sources."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT * FROM funding_sources ORDER BY name")
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving funding sources: {e}")
            raise
    
    def update_funding_source(self, source_id: int, **kwargs) -> bool:
        """Update funding source fields."""
        try:
            if not kwargs:
                return False
            
            fields = []
            values = []
            for key, value in kwargs.items():
                if key in ['name', 'source_type', 'description', 'budget_limit',
                          'current_balance', 'account_number', 'contact_person']:
                    fields.append(f"{key} = ?")
                    values.append(value)
            
            if not fields:
                return False
            
            fields.append("last_updated = CURRENT_TIMESTAMP")
            values.append(source_id)
            
            query = f"UPDATE funding_sources SET {', '.join(fields)} WHERE id = ?"
            cursor = self.conn.cursor()
            cursor.execute(query, values)
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error updating funding source: {e}")
            raise
    
    def delete_funding_source(self, source_id: int) -> bool:
        """Delete a funding source."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("DELETE FROM funding_sources WHERE id = ?", (source_id,))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error deleting funding source: {e}")
            raise
    
    # Purchases CRUD Operations
    
    def add_purchase(self, item_type: str, item_id: int, purchase_date: str, cost: float,
                    funding_source_id: Optional[int] = None, currency: str = 'USD',
                    vendor: Optional[str] = None, invoice_number: Optional[str] = None,
                    payment_method: Optional[str] = None, notes: Optional[str] = None) -> int:
        """Record a purchase."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO purchases (item_type, item_id, funding_source_id, purchase_date,
                                     cost, currency, vendor, invoice_number, payment_method, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (item_type, item_id, funding_source_id, purchase_date, cost, 
                  currency, vendor, invoice_number, payment_method, notes))
            self.conn.commit()
            
            # Update funding source balance if applicable
            if funding_source_id:
                self.update_funding_source(funding_source_id, 
                                          current_balance=self.get_funding_source(funding_source_id)['current_balance'] - cost)
            
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding purchase: {e}")
            raise
    
    def get_purchase(self, purchase_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve a purchase by ID."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT * FROM purchases WHERE id = ?", (purchase_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.Error as e:
            print(f"Error retrieving purchase: {e}")
            raise
    
    def get_purchases_by_item(self, item_type: str, item_id: int) -> List[Dict[str, Any]]:
        """Retrieve all purchases for a specific item."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                SELECT * FROM purchases 
                WHERE item_type = ? AND item_id = ? 
                ORDER BY purchase_date DESC
            """, (item_type, item_id))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving purchases: {e}")
            raise
    
    def get_all_purchases(self, funding_source_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Retrieve all purchases, optionally filtered by funding source."""
        try:
            cursor = self.conn.cursor()
            if funding_source_id:
                cursor.execute("""
                    SELECT * FROM purchases 
                    WHERE funding_source_id = ? 
                    ORDER BY purchase_date DESC
                """, (funding_source_id,))
            else:
                cursor.execute("SELECT * FROM purchases ORDER BY purchase_date DESC")
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving purchases: {e}")
            raise
    
    def delete_purchase(self, purchase_id: int) -> bool:
        """Delete a purchase."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("DELETE FROM purchases WHERE id = ?", (purchase_id,))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error deleting purchase: {e}")
            raise
    
    # Maintenance Costs CRUD Operations
    
    def add_maintenance_cost(self, item_type: str, item_id: int, maintenance_date: str, cost: float,
                             funding_source_id: Optional[int] = None, currency: str = 'USD',
                             service_provider: Optional[str] = None, description: Optional[str] = None,
                             invoice_number: Optional[str] = None, notes: Optional[str] = None) -> int:
        """Record a maintenance cost."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO maintenance_costs (item_type, item_id, funding_source_id, maintenance_date,
                                             cost, currency, service_provider, description, invoice_number, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (item_type, item_id, funding_source_id, maintenance_date, cost, 
                  currency, service_provider, description, invoice_number, notes))
            self.conn.commit()
            
            # Update funding source balance if applicable
            if funding_source_id:
                self.update_funding_source(funding_source_id, 
                                          current_balance=self.get_funding_source(funding_source_id)['current_balance'] - cost)
            
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding maintenance cost: {e}")
            raise
    
    def get_maintenance_cost(self, cost_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve a maintenance cost by ID."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT * FROM maintenance_costs WHERE id = ?", (cost_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.Error as e:
            print(f"Error retrieving maintenance cost: {e}")
            raise
    
    def get_maintenance_costs_by_item(self, item_type: str, item_id: int) -> List[Dict[str, Any]]:
        """Retrieve all maintenance costs for a specific item."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                SELECT * FROM maintenance_costs 
                WHERE item_type = ? AND item_id = ? 
                ORDER BY maintenance_date DESC
            """, (item_type, item_id))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving maintenance costs: {e}")
            raise
    
    def get_all_maintenance_costs(self, funding_source_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Retrieve all maintenance costs, optionally filtered by funding source."""
        try:
            cursor = self.conn.cursor()
            if funding_source_id:
                cursor.execute("""
                    SELECT * FROM maintenance_costs 
                    WHERE funding_source_id = ? 
                    ORDER BY maintenance_date DESC
                """, (funding_source_id,))
            else:
                cursor.execute("SELECT * FROM maintenance_costs ORDER BY maintenance_date DESC")
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving maintenance costs: {e}")
            raise
    
    def delete_maintenance_cost(self, cost_id: int) -> bool:
        """Delete a maintenance cost."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("DELETE FROM maintenance_costs WHERE id = ?", (cost_id,))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error deleting maintenance cost: {e}")
            raise
    
    # Gains/Income CRUD Operations
    
    def add_gain(self, gain_type: str, amount: float, gain_date: str,
                currency: str = 'USD', source: Optional[str] = None, 
                description: Optional[str] = None, funding_source_id: Optional[int] = None,
                project_id: Optional[int] = None, category: Optional[str] = None,
                status: str = 'confirmed') -> int:
        """Record a gain/income."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO gains (gain_type, amount, currency, gain_date, source, description,
                                 funding_source_id, project_id, category, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (gain_type, amount, currency, gain_date, source, description,
                  funding_source_id, project_id, category, status))
            self.conn.commit()
            
            # Update funding source balance if applicable
            if funding_source_id:
                self.update_funding_source(funding_source_id, 
                                          current_balance=self.get_funding_source(funding_source_id)['current_balance'] + amount)
            
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error adding gain: {e}")
            raise
    
    def get_gain(self, gain_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve a gain by ID."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT * FROM gains WHERE id = ?", (gain_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.Error as e:
            print(f"Error retrieving gain: {e}")
            raise
    
    def get_all_gains(self, funding_source_id: Optional[int] = None, 
                     project_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Retrieve all gains, optionally filtered by funding source or project."""
        try:
            cursor = self.conn.cursor()
            if funding_source_id:
                cursor.execute("""
                    SELECT * FROM gains 
                    WHERE funding_source_id = ? 
                    ORDER BY gain_date DESC
                """, (funding_source_id,))
            elif project_id:
                cursor.execute("""
                    SELECT * FROM gains 
                    WHERE project_id = ? 
                    ORDER BY gain_date DESC
                """, (project_id,))
            else:
                cursor.execute("SELECT * FROM gains ORDER BY gain_date DESC")
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving gains: {e}")
            raise
    
    def update_gain(self, gain_id: int, **kwargs) -> bool:
        """Update gain fields."""
        try:
            if not kwargs:
                return False
            
            fields = []
            values = []
            
            for key, value in kwargs.items():
                if key in ['gain_type', 'amount', 'currency', 'gain_date', 'source', 
                          'description', 'funding_source_id', 'project_id', 'category', 'status']:
                    fields.append(f"{key} = ?")
                    values.append(value)
            
            if not fields:
                return False
            
            values.append(gain_id)
            
            query = f"UPDATE gains SET {', '.join(fields)} WHERE id = ?"
            cursor = self.conn.cursor()
            cursor.execute(query, values)
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error updating gain: {e}")
            raise
    
    def delete_gain(self, gain_id: int) -> bool:
        """Delete a gain."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("DELETE FROM gains WHERE id = ?", (gain_id,))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error deleting gain: {e}")
            raise
    
    def log_activity(self, action: str, entity_type: str, entity_id: Optional[int] = None,
                     entity_name: Optional[str] = None, details: Optional[str] = None) -> int:
        """Log an activity to the audit trail."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO lab_activity_log (action, entity_type, entity_id, entity_name, details)
                VALUES (?, ?, ?, ?, ?)
            """, (action, entity_type, entity_id, entity_name, details))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error logging activity: {e}")
            raise
    
    def get_recent_activities(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recent activities from the audit trail."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                SELECT * FROM lab_activity_log
                ORDER BY timestamp DESC
                LIMIT ?
            """, (limit,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving recent activities: {e}")
            raise
    
    def delete_old_activities(self, hours: int = 24) -> int:
        """Delete activity log entries older than specified hours."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                DELETE FROM lab_activity_log
                WHERE datetime(timestamp) < datetime('now', '-' || ? || ' hours')
            """, (hours,))
            self.conn.commit()
            return cursor.rowcount
        except sqlite3.Error as e:
            print(f"Error deleting old activities: {e}")
            raise
    
    def save_ai_chat_message(self, session_id: str, role: str, content: str,
                            project_id: Optional[int] = None, experiment_id: Optional[int] = None) -> int:
        """Save an AI chat message to the history."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO ai_chat_history (session_id, role, content, project_id, experiment_id)
                VALUES (?, ?, ?, ?, ?)
            """, (session_id, role, content, project_id, experiment_id))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Error saving AI chat message: {e}")
            raise
    
    def get_ai_chat_history(self, session_id: str, project_id: Optional[int] = None,
                           experiment_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get AI chat history for a session."""
        try:
            cursor = self.conn.cursor()
            if project_id is not None:
                cursor.execute("""
                    SELECT * FROM ai_chat_history
                    WHERE session_id = ? AND project_id = ?
                    ORDER BY timestamp ASC
                """, (session_id, project_id))
            elif experiment_id is not None:
                cursor.execute("""
                    SELECT * FROM ai_chat_history
                    WHERE session_id = ? AND experiment_id = ?
                    ORDER BY timestamp ASC
                """, (session_id, experiment_id))
            else:
                cursor.execute("""
                    SELECT * FROM ai_chat_history
                    WHERE session_id = ?
                    ORDER BY timestamp ASC
                """, (session_id,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving AI chat history: {e}")
            raise
    
    def delete_ai_chat_history(self, session_id: str) -> bool:
        """Delete AI chat history for a session."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("DELETE FROM ai_chat_history WHERE session_id = ?", (session_id,))
            self.conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            print(f"Error deleting AI chat history: {e}")
            raise
    
    def get_ai_chat_sessions(self) -> List[Dict[str, Any]]:
        """Get all unique chat session IDs with metadata."""
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                SELECT 
                    session_id,
                    COUNT(*) as message_count,
                    MIN(timestamp) as first_message,
                    MAX(timestamp) as last_message
                FROM ai_chat_history
                GROUP BY session_id
                ORDER BY last_message DESC
            """)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            print(f"Error retrieving AI chat sessions: {e}")
            raise


# Convenience function for quick database access
def get_cache(db_path: str = "local_cache.db") -> CacheDatabase:
    """
    Get a cache database instance.
    
    Args:
        db_path: Path to the SQLite database file
        
    Returns:
        CacheDatabase instance
    """
    return CacheDatabase(db_path)


if __name__ == "__main__":
    # Test the database initialization
    with CacheDatabase() as db:
        print("Database initialized successfully!")
        
        # Add sample equipment
        db.add_equipment("Spectrometer", "Model X-100", "available", "2024-01-15")
        db.add_equipment("Centrifuge", "SpinMaster 5000", "in_use", "2024-02-20")
        
        # Add sample R&D log
        db.add_rd_log(
            project_name="Sensor Calibration",
            log_title="Initial calibration run",
            log_text="Performed baseline calibration on all sensors.",
            cloud_file_url="https://cloud.example.com/bucket/calibration_data.csv",
            is_downloaded_locally=False
        )
        
        # Query and display
        print("\nEquipment:")
        for eq in db.get_all_equipment():
            print(f"  - {eq['name']} ({eq['model']}): {eq['status']}")
        
        print("\nR&D Logs:")
        for log in db.get_all_rd_logs():
            downloaded = "Yes" if log['is_downloaded_locally'] else "No"
            print(f"  - {log['log_title']} (Downloaded: {downloaded})")
