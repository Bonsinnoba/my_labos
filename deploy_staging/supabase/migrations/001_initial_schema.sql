-- Initial Schema Migration for Lab R&D Operating System
-- Mirrors SQLite schema to PostgreSQL with UUID primary keys and RLS

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable Row Level Security
ALTER DATABASE postgres SET default_table_access_method = 'heap';

-- ============================================
-- EQUIPMENT TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    model TEXT,
    status TEXT NOT NULL DEFAULT 'available',
    calibration_date TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_equipment_updated_at ON equipment(updated_at);
CREATE INDEX idx_equipment_status ON equipment(status);
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY equipment_select ON equipment FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY equipment_insert ON equipment FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY equipment_update ON equipment FOR UPDATE TO authenticated USING (true);

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Active',
    start_date TEXT,
    summary_findings TEXT,
    project_outcome TEXT,
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_projects_updated_at ON projects(updated_at);
CREATE INDEX idx_projects_status ON projects(status);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_select ON projects FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY projects_insert ON projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY projects_update ON projects FOR UPDATE TO authenticated USING (true);

-- ============================================
-- RD_LOGS TABLE (Research & Development Logs)
-- ============================================
CREATE TABLE IF NOT EXISTS rd_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID,
    project_name TEXT,
    log_title TEXT NOT NULL,
    log_text TEXT,
    cloud_file_url TEXT,
    is_downloaded_locally INTEGER DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'Active',
    outcome TEXT DEFAULT 'PENDING',
    expected_outcome TEXT,
    actual_outcome TEXT,
    findings TEXT,
    outcome_attachments TEXT,
    findings_attachments TEXT,
    conclusion TEXT,
    stage_id UUID,
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX idx_rd_logs_updated_at ON rd_logs(updated_at);
CREATE INDEX idx_rd_logs_project ON rd_logs(project_name);
CREATE INDEX idx_rd_logs_project_id ON rd_logs(project_id);
CREATE INDEX idx_rd_logs_downloaded ON rd_logs(is_downloaded_locally);
CREATE INDEX idx_rd_logs_stage_id ON rd_logs(stage_id);
ALTER TABLE rd_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY rd_logs_select ON rd_logs FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY rd_logs_insert ON rd_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY rd_logs_update ON rd_logs FOR UPDATE TO authenticated USING (true);

-- ============================================
-- KNOWLEDGE_VAULT TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_vault (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    description TEXT,
    metadata TEXT,
    tags TEXT,
    project_id UUID,
    component_id UUID,
    equipment_id UUID,
    experiment_id UUID,
    stage_id UUID,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed TIMESTAMP WITH TIME ZONE,
    cloud_file_url TEXT,
    is_synced INTEGER DEFAULT 0,
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE SET NULL
);

CREATE INDEX idx_knowledge_vault_updated_at ON knowledge_vault(updated_at);
CREATE INDEX idx_knowledge_vault_project ON knowledge_vault(project_id);
CREATE INDEX idx_knowledge_vault_component ON knowledge_vault(component_id);
CREATE INDEX idx_knowledge_vault_type ON knowledge_vault(file_type);
ALTER TABLE knowledge_vault ENABLE ROW LEVEL SECURITY;

CREATE POLICY knowledge_vault_select ON knowledge_vault FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY knowledge_vault_insert ON knowledge_vault FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY knowledge_vault_update ON knowledge_vault FOR UPDATE TO authenticated USING (true);

-- ============================================
-- NOTEBOOK_ENTRIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notebook_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    entry_type TEXT DEFAULT 'text',
    project_id UUID,
    experiment_id UUID,
    tags TEXT,
    attachments TEXT,
    voice_transcription TEXT,
    source TEXT DEFAULT 'pc',
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX idx_notebook_entries_updated_at ON notebook_entries(updated_at);
CREATE INDEX idx_notebook_entries_project ON notebook_entries(project_id);
CREATE INDEX idx_notebook_entries_date ON notebook_entries(created_at);
CREATE INDEX idx_notebook_entries_source ON notebook_entries(source);
ALTER TABLE notebook_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY notebook_entries_select ON notebook_entries FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY notebook_entries_insert ON notebook_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY notebook_entries_update ON notebook_entries FOR UPDATE TO authenticated USING (true);

-- ============================================
-- COMPONENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_components_updated_at ON components(updated_at);
CREATE INDEX idx_components_part_number ON components(part_number);
CREATE INDEX idx_components_quantity ON components(quantity);
ALTER TABLE components ENABLE ROW LEVEL SECURITY;

CREATE POLICY components_select ON components FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY components_insert ON components FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY components_update ON components FOR UPDATE TO authenticated USING (true);

-- ============================================
-- EQUIPMENT_MAINTENANCE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS equipment_maintenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL,
    maintenance_type TEXT NOT NULL,
    description TEXT,
    performed_date TEXT,
    next_due_date TEXT,
    performed_by TEXT,
    notes TEXT,
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
);

CREATE INDEX idx_equipment_maintenance_updated_at ON equipment_maintenance(updated_at);
CREATE INDEX idx_equipment_maintenance_equipment ON equipment_maintenance(equipment_id);
CREATE INDEX idx_equipment_maintenance_due ON equipment_maintenance(next_due_date);
ALTER TABLE equipment_maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY equipment_maintenance_select ON equipment_maintenance FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY equipment_maintenance_insert ON equipment_maintenance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY equipment_maintenance_update ON equipment_maintenance FOR UPDATE TO authenticated USING (true);

-- ============================================
-- FINDINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    finding_type TEXT NOT NULL,
    description TEXT NOT NULL,
    root_cause TEXT,
    solution TEXT,
    recommendations TEXT,
    project_id UUID,
    experiment_id UUID,
    stage_id UUID,
    severity TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open',
    resolved_at TIMESTAMP WITH TIME ZONE,
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX idx_findings_updated_at ON findings(updated_at);
CREATE INDEX idx_findings_project ON findings(project_id);
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY findings_select ON findings FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY findings_insert ON findings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY findings_update ON findings FOR UPDATE TO authenticated USING (true);

-- ============================================
-- CALCULATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    calculation_type TEXT NOT NULL,
    input_parameters TEXT NOT NULL,
    result TEXT NOT NULL,
    formula TEXT,
    project_id UUID,
    component_id UUID,
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX idx_calculations_updated_at ON calculations(updated_at);
ALTER TABLE calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY calculations_select ON calculations FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY calculations_insert ON calculations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY calculations_update ON calculations FOR UPDATE TO authenticated USING (true);

-- ============================================
-- RELATIONSHIPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL,
    source_id UUID NOT NULL,
    target_type TEXT NOT NULL,
    target_id UUID NOT NULL,
    relationship_type TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_type, source_id, target_type, target_id, relationship_type)
);

CREATE INDEX idx_relationships_updated_at ON relationships(updated_at);
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY relationships_select ON relationships FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY relationships_insert ON relationships FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY relationships_update ON relationships FOR UPDATE TO authenticated USING (true);

-- ============================================
-- COMPONENT_USAGE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS component_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID NOT NULL,
    project_id UUID,
    experiment_id UUID,
    quantity_used INTEGER DEFAULT 1,
    usage_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX idx_component_usage_updated_at ON component_usage(updated_at);
ALTER TABLE component_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY component_usage_select ON component_usage FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY component_usage_insert ON component_usage FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY component_usage_update ON component_usage FOR UPDATE TO authenticated USING (true);

-- ============================================
-- TOOLS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tools_updated_at ON tools(updated_at);
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY tools_select ON tools FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY tools_insert ON tools FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY tools_update ON tools FOR UPDATE TO authenticated USING (true);

-- ============================================
-- MATERIALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_materials_updated_at ON materials(updated_at);
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY materials_select ON materials FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY materials_insert ON materials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY materials_update ON materials FOR UPDATE TO authenticated USING (true);

-- ============================================
-- EQUIPMENT_USAGE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS equipment_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL,
    project_id UUID,
    experiment_id UUID,
    usage_type TEXT DEFAULT 'checkout',
    usage_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    return_date TIMESTAMP WITH TIME ZONE,
    used_by TEXT,
    post_use_status TEXT DEFAULT 'usable',
    condition_notes TEXT,
    efficiency_percentage REAL,
    notes TEXT,
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX idx_equipment_usage_updated_at ON equipment_usage(updated_at);
ALTER TABLE equipment_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY equipment_usage_select ON equipment_usage FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY equipment_usage_insert ON equipment_usage FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY equipment_usage_update ON equipment_usage FOR UPDATE TO authenticated USING (true);

-- ============================================
-- TOOL_USAGE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tool_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id UUID NOT NULL,
    project_id UUID,
    experiment_id UUID,
    quantity_used INTEGER DEFAULT 1,
    amount_left INTEGER DEFAULT 0,
    usage_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    post_use_status TEXT DEFAULT 'usable',
    condition_notes TEXT,
    efficiency_percentage REAL,
    notes TEXT,
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX idx_tool_usage_updated_at ON tool_usage(updated_at);
ALTER TABLE tool_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY tool_usage_select ON tool_usage FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY tool_usage_insert ON tool_usage FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY tool_usage_update ON tool_usage FOR UPDATE TO authenticated USING (true);

-- ============================================
-- MATERIAL_USAGE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS material_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL,
    project_id UUID,
    experiment_id UUID,
    quantity_used REAL DEFAULT 0,
    amount_left REAL DEFAULT 0,
    usage_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    post_use_status TEXT DEFAULT 'usable',
    condition_notes TEXT,
    notes TEXT,
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX idx_material_usage_updated_at ON material_usage(updated_at);
ALTER TABLE material_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY material_usage_select ON material_usage FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY material_usage_insert ON material_usage FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY material_usage_update ON material_usage FOR UPDATE TO authenticated USING (true);

-- ============================================
-- USAGE_LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID,
    experiment_id UUID,
    stage_id UUID,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    quantity_used REAL DEFAULT 0,
    unit TEXT,
    amount_left REAL,
    post_use_status TEXT,
    notes TEXT,
    user_id UUID DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX idx_usage_logs_updated_at ON usage_logs(updated_at);
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_logs_select ON usage_logs FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY usage_logs_insert ON usage_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY usage_logs_update ON usage_logs FOR UPDATE TO authenticated USING (true);

-- ============================================
-- PROJECT_STAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS project_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    stage_name TEXT NOT NULL,
    owner TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'not_started',
    notes TEXT,
    attachments TEXT,
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, stage_name)
);

CREATE INDEX idx_project_stages_updated_at ON project_stages(updated_at);
ALTER TABLE project_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_stages_select ON project_stages FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY project_stages_insert ON project_stages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY project_stages_update ON project_stages FOR UPDATE TO authenticated USING (true);

-- ============================================
-- EXPERIMENT_STAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS experiment_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL,
    stage_name TEXT NOT NULL,
    owner TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'not_started',
    notes TEXT,
    attachments TEXT,
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (experiment_id) REFERENCES rd_logs(id) ON DELETE CASCADE,
    UNIQUE(experiment_id, stage_name)
);

CREATE INDEX idx_experiment_stages_updated_at ON experiment_stages(updated_at);
ALTER TABLE experiment_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY experiment_stages_select ON experiment_stages FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY experiment_stages_insert ON experiment_stages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY experiment_stages_update ON experiment_stages FOR UPDATE TO authenticated USING (true);

-- ============================================
-- FUNDING_SOURCES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS funding_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    description TEXT,
    budget_limit REAL,
    current_balance REAL DEFAULT 0,
    account_number TEXT,
    contact_person TEXT,
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_funding_sources_updated_at ON funding_sources(updated_at);
ALTER TABLE funding_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY funding_sources_select ON funding_sources FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY funding_sources_insert ON funding_sources FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY funding_sources_update ON funding_sources FOR UPDATE TO authenticated USING (true);

-- ============================================
-- PURCHASES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type TEXT NOT NULL,
    item_id UUID NOT NULL,
    funding_source_id UUID,
    purchase_date TEXT NOT NULL,
    cost REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    vendor TEXT,
    invoice_number TEXT,
    payment_method TEXT,
    notes TEXT,
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (funding_source_id) REFERENCES funding_sources(id) ON DELETE SET NULL
);

CREATE INDEX idx_purchases_updated_at ON purchases(updated_at);
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY purchases_select ON purchases FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY purchases_insert ON purchases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY purchases_update ON purchases FOR UPDATE TO authenticated USING (true);

-- ============================================
-- MAINTENANCE_COSTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS maintenance_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type TEXT NOT NULL,
    item_id UUID NOT NULL,
    funding_source_id UUID,
    maintenance_date TEXT NOT NULL,
    cost REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    service_provider TEXT,
    description TEXT,
    invoice_number TEXT,
    notes TEXT,
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (funding_source_id) REFERENCES funding_sources(id) ON DELETE SET NULL
);

CREATE INDEX idx_maintenance_costs_updated_at ON maintenance_costs(updated_at);
ALTER TABLE maintenance_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY maintenance_costs_select ON maintenance_costs FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY maintenance_costs_insert ON maintenance_costs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY maintenance_costs_update ON maintenance_costs FOR UPDATE TO authenticated USING (true);

-- ============================================
-- GAINS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS gains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gain_type TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    gain_date TEXT NOT NULL,
    source TEXT,
    description TEXT,
    funding_source_id UUID,
    project_id UUID,
    category TEXT,
    status TEXT DEFAULT 'confirmed',
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (funding_source_id) REFERENCES funding_sources(id) ON DELETE SET NULL
);

CREATE INDEX idx_gains_updated_at ON gains(updated_at);
ALTER TABLE gains ENABLE ROW LEVEL SECURITY;

CREATE POLICY gains_select ON gains FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY gains_insert ON gains FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY gains_update ON gains FOR UPDATE TO authenticated USING (true);

-- ============================================
-- LAB_ACTIVITY_LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS lab_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    entity_name TEXT,
    user_id UUID DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    details TEXT,
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_lab_activity_log_updated_at ON lab_activity_log(updated_at);
ALTER TABLE lab_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY lab_activity_log_select ON lab_activity_log FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY lab_activity_log_insert ON lab_activity_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY lab_activity_log_update ON lab_activity_log FOR UPDATE TO authenticated USING (true);

-- ============================================
-- ASSET_SYNC_LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS asset_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    action_type TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_asset_sync_log_updated_at ON asset_sync_log(updated_at);
CREATE INDEX idx_asset_sync_log_timestamp ON asset_sync_log(timestamp);
ALTER TABLE asset_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY asset_sync_log_select ON asset_sync_log FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY asset_sync_log_insert ON asset_sync_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY asset_sync_log_update ON asset_sync_log FOR UPDATE TO authenticated USING (true);

-- ============================================
-- AI_CHAT_HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ai_chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    project_id UUID,
    experiment_id UUID,
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_chat_history_updated_at ON ai_chat_history(updated_at);
CREATE INDEX idx_ai_chat_history_session ON ai_chat_history(session_id);
ALTER TABLE ai_chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_chat_history_select ON ai_chat_history FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY ai_chat_history_insert ON ai_chat_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY ai_chat_history_update ON ai_chat_history FOR UPDATE TO authenticated USING (true);

-- ============================================
-- MESH_TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS mesh_transactions (
    tx_id TEXT PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    device_origin TEXT NOT NULL,
    is_tombstone INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mesh_transactions_updated_at ON mesh_transactions(updated_at);
CREATE INDEX idx_mesh_transactions_timestamp ON mesh_transactions(timestamp);
CREATE INDEX idx_mesh_transactions_table ON mesh_transactions(table_name);
CREATE INDEX idx_mesh_transactions_device ON mesh_transactions(device_origin);
ALTER TABLE mesh_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY mesh_transactions_select ON mesh_transactions FOR SELECT TO authenticated USING (is_tombstone = 0);
CREATE POLICY mesh_transactions_insert ON mesh_transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY mesh_transactions_update ON mesh_transactions FOR UPDATE TO authenticated USING (true);

-- ============================================
-- TRIGGER FOR UPDATED_AT
-- ============================================
-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to all tables that have updated_at
DO $$
DECLARE
    tbl_name TEXT;
BEGIN
    FOR tbl_name IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name != 'mesh_transactions'  -- Skip mesh_transactions as it uses integer timestamp
    LOOP
        EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', tbl_name, tbl_name);
    END LOOP;
END $$;
