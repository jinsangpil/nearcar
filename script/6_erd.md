erDiagram
    %% 1. Users & Regions
    users {
        UUID id PK
        VARCHAR role "client, inspector, admin"
        VARCHAR name
        VARCHAR phone
        UUID region_id FK
        INT level
        DECIMAL commission_rate
    }

    service_regions {
        UUID id PK
        VARCHAR province
        VARCHAR city
        INT extra_fee
    }

    users }o--|| service_regions : "activity region (inspector)"

    %% 2. Vehicles & Master Data
    vehicle_master {
        UUID id PK
        VARCHAR origin
        VARCHAR manufacturer
        VARCHAR model_group
        VARCHAR vehicle_class
    }

    vehicles {
        UUID id PK
        UUID user_id FK
        UUID master_id FK
        VARCHAR plate_number
        BOOLEAN is_flooded
    }

    price_policies {
        UUID id PK
        VARCHAR origin
        VARCHAR vehicle_class
        INT add_amount
    }

    %% Logical link for pricing (Not a strict DB FK, but a business logic link)
    vehicle_master }o..o{ price_policies : "maps via vehicle_class"

    users ||--o{ vehicles : "owns"
    vehicles }o--|| vehicle_master : "defined by"

    %% 3. Inspections (Core)
    packages {
        UUID id PK
        VARCHAR name
        INT base_price
        JSONB included_items
    }

    inspections {
        UUID id PK
        UUID user_id FK
        UUID inspector_id FK
        UUID vehicle_id FK
        UUID package_id FK
        VARCHAR status
        INT total_amount
    }

    inspections }o--|| users : "requested by (client)"
    inspections }o--|| users : "assigned to (inspector)"
    inspections }o--|| vehicles : "targets"
    inspections }o--|| packages : "selects"

    %% 4. Reports, Payments, Settlements
    inspection_reports {
        UUID id PK
        UUID inspection_id FK
        JSONB checklist_data
        VARCHAR pdf_url
        VARCHAR status
    }

    payments {
        UUID id PK
        UUID inspection_id FK
        INT amount
        VARCHAR status
    }

    settlements {
        UUID id PK
        UUID inspector_id FK
        UUID inspection_id FK
        INT settle_amount
        VARCHAR status
    }

    inspections ||--|| inspection_reports : "generates"
    inspections ||--|| payments : "paid via"
    inspections ||--|| settlements : "triggers"
    users ||--o{ settlements : "receives"

    %% 5. Notifications
    notifications {
        SERIAL id PK
        UUID user_id FK
        VARCHAR channel
        VARCHAR status
    }

    users ||--o{ notifications : "receives"