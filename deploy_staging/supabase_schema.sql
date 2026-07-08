-- Supabase Schema for Lab R&D System
-- Complete database schema matching local SQLite database
-- Using UUID for primary keys (Supabase default)

-- Core Tables
CREATE TABLE IF NOT EXISTS projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Active',
    start_date TIMESTAMP,
    summary_findings TEXT,
    project_outcome TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    edited_by TEXT,
    edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS experiments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    project_name TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    expected_outcome TEXT,
    actual_outcome TEXT,
    findings TEXT,
    stage_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    edited_by TEXT,
    edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge & Documents
CREATE TABLE IF NOT EXISTS knowledge_vault (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT,
    description TEXT,
    metadata TEXT,
    tags TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    component_id UUID,
    equipment_id UUID,
    experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL,
    stage_id UUID,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP,
    created_by TEXT,
    edited_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cloud_synced INTEGER DEFAULT 0,
    cloud_file_url TEXT
);

CREATE TABLE IF NOT EXISTS notebook_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    entry_type TEXT DEFAULT 'text',
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL,
    tags TEXT,
    attachments TEXT,
    voice_transcription TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    edited_by TEXT
);

-- Inventory Tables
CREATE TABLE IF NOT EXISTS equipment (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    model TEXT,
    serial_number TEXT,
    description TEXT,
    status TEXT DEFAULT 'available',
    location TEXT,
    purchase_date TEXT,
    purchase_cost REAL,
    calibration_date TEXT,
    next_calibration_date TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS equipment_maintenance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
    maintenance_type TEXT NOT NULL,
    description TEXT,
    performed_date TEXT,
    next_due_date TEXT,
    performed_by TEXT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS components (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
);

CREATE TABLE IF NOT EXISTS tools (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
);

CREATE TABLE IF NOT EXISTS materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
);

CREATE TABLE IF NOT EXISTS others (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    location TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usage Tracking
CREATE TABLE IF NOT EXISTS component_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL,
    quantity_used INTEGER DEFAULT 1,
    usage_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS equipment_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL,
    usage_type TEXT DEFAULT 'checkout',
    usage_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    return_date TIMESTAMP,
    used_by TEXT,
    post_use_status TEXT DEFAULT 'usable',
    condition_notes TEXT,
    efficiency_percentage REAL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS tool_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL,
    quantity_used INTEGER DEFAULT 1,
    amount_left INTEGER DEFAULT 0,
    usage_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    post_use_status TEXT DEFAULT 'usable',
    condition_notes TEXT,
    efficiency_percentage REAL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS material_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL,
    quantity_used REAL DEFAULT 0,
    amount_left REAL DEFAULT 0,
    usage_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    post_use_status TEXT DEFAULT 'usable',
    condition_notes TEXT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL,
    stage_id UUID,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    quantity_used REAL DEFAULT 0,
    unit TEXT,
    amount_left REAL,
    post_use_status TEXT,
    notes TEXT,
    user_id INTEGER DEFAULT 1,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project & Experiment Stages
CREATE TABLE IF NOT EXISTS project_stages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    stage_name TEXT NOT NULL,
    owner TEXT,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    status TEXT DEFAULT 'not_started',
    notes TEXT,
    attachments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, stage_name)
);

CREATE TABLE IF NOT EXISTS experiment_stages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE,
    stage_name TEXT NOT NULL,
    owner TEXT,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    status TEXT DEFAULT 'not_started',
    notes TEXT,
    attachments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(experiment_id, stage_name)
);

-- Findings & Analysis
CREATE TABLE IF NOT EXISTS findings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    finding_type TEXT NOT NULL,
    description TEXT NOT NULL,
    root_cause TEXT,
    solution TEXT,
    recommendations TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL,
    stage_id UUID,
    severity TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    created_by TEXT
);

CREATE TABLE IF NOT EXISTS calculations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    calculation_type TEXT NOT NULL,
    input_parameters TEXT NOT NULL,
    result TEXT NOT NULL,
    formula TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    component_id UUID REFERENCES components(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS relationships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_type TEXT NOT NULL,
    source_id UUID NOT NULL,
    target_type TEXT NOT NULL,
    target_id UUID NOT NULL,
    relationship_type TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_type, source_id, target_type, target_id, relationship_type)
);

-- Finance Tables
CREATE TABLE IF NOT EXISTS funding_sources (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    description TEXT,
    budget_limit REAL,
    current_balance REAL DEFAULT 0,
    account_number TEXT,
    contact_person TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_type TEXT NOT NULL,
    item_id UUID NOT NULL,
    funding_source_id UUID REFERENCES funding_sources(id) ON DELETE SET NULL,
    purchase_date TEXT NOT NULL,
    cost REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    vendor TEXT,
    invoice_number TEXT,
    payment_method TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS maintenance_costs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_type TEXT NOT NULL,
    item_id UUID NOT NULL,
    funding_source_id UUID REFERENCES funding_sources(id) ON DELETE SET NULL,
    maintenance_date TEXT NOT NULL,
    cost REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    service_provider TEXT,
    description TEXT,
    invoice_number TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gains (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gain_type TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    gain_date TEXT NOT NULL,
    source TEXT,
    description TEXT,
    funding_source_id UUID REFERENCES funding_sources(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    category TEXT,
    status TEXT DEFAULT 'confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit & Sync Tables
CREATE TABLE IF NOT EXISTS lab_activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    entity_name TEXT,
    user_id INTEGER DEFAULT 1,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details TEXT
);

CREATE TABLE IF NOT EXISTS asset_sync_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_name TEXT NOT NULL,
    action_type TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS mesh_transactions;
CREATE TABLE mesh_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    record_id UUID,
    data JSONB,
    is_synced INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ai_chat_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_experiments_project ON experiments(project_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_vault_project ON knowledge_vault(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_vault_experiment ON knowledge_vault(experiment_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_vault_component ON knowledge_vault(component_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_vault_type ON knowledge_vault(file_type);
CREATE INDEX IF NOT EXISTS idx_notebook_project ON notebook_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_notebook_date ON notebook_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_components_part_number ON components(part_number);
CREATE INDEX IF NOT EXISTS idx_components_quantity ON components(quantity);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_equipment ON equipment_maintenance(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_due ON equipment_maintenance(next_due_date);
CREATE INDEX IF NOT EXISTS idx_findings_project ON findings(project_id);
CREATE INDEX IF NOT EXISTS idx_findings_experiment ON findings(experiment_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_usage_logs_project ON usage_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_experiment ON usage_logs(experiment_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_timestamp ON usage_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_mesh_transactions_device ON mesh_transactions(device_id);
CREATE INDEX IF NOT EXISTS idx_mesh_transactions_timestamp ON mesh_transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_mesh_transactions_synced ON mesh_transactions(is_synced);
CREATE INDEX IF NOT EXISTS idx_ai_chat_history_session ON ai_chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_asset_sync_log_timestamp ON asset_sync_log(timestamp);
