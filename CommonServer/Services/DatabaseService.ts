import Slug from 'Common/Utils/Slug';
import FindOneBy from '../Types/Database/FindOneBy';
import UpdateOneBy from '../Types/Database/UpdateOneBy';
import CountBy from '../Types/Database/CountBy';
import DeleteOneBy from '../Types/Database/DeleteOneBy';
import SearchBy from '../Types/Database/SearchBy';
import DeleteBy from '../Types/Database/DeleteBy';
import PositiveNumber from 'Common/Types/PositiveNumber';
import FindBy from '../Types/Database/FindBy';
import UpdateBy from '../Types/Database/UpdateBy';
import Query from '../Types/Database/Query';
import CreateBy from '../Types/Database/CreateBy';
import BadDataException from 'Common/Types/Exception/BadDataException';
import DatabaseNotConnectedException from 'Common/Types/Exception/DatabaseNotConnectedException';
import Exception from 'Common/Types/Exception/Exception';
import SearchResult from '../Types/Database/SearchResult';
import Encryption from '../Utils/Encryption';
import { JSONObject } from 'Common/Types/JSON';
import BaseModel from 'Common/Models/BaseModel';
import PostgresDatabase, {
    PostgresAppInstance,
} from '../Infrastructure/PostgresDatabase';
import {
    DataSource,
    FindOperator,
    Repository,
    SelectQueryBuilder,
} from 'typeorm';
import ObjectID from 'Common/Types/ObjectID';
import SortOrder from 'Common/Types/Database/SortOrder';
import { EncryptionSecret } from '../Config';
import HashedString from 'Common/Types/HashedString';
import UpdateByID from '../Types/Database/UpdateByID';
import Columns from 'Common/Types/Database/Columns';
import FindOneByID from '../Types/Database/FindOneByID';
import Permission, {
    PermissionHelper,
    UserPermission,
} from 'Common/Types/Permission';
import { ColumnAccessControl } from 'Common/Types/Database/AccessControl/AccessControl';
import Dictionary from 'Common/Types/Dictionary';
import NotAuthorizedException from 'Common/Types/Exception/NotAuthorizedException';
import DatabaseCommonInteractionProps from 'Common/Types/Database/DatabaseCommonInteractionProps';
import QueryHelper from '../Types/Database/QueryHelper';
import { getUniqueColumnsBy } from 'Common/Types/Database/UniqueColumnBy';
import Search from 'Common/Types/Database/Search';
import Typeof from 'Common/Types/Typeof';
import TableColumnType from 'Common/Types/Database/TableColumnType';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import LIMIT_MAX from 'Common/Types/Database/LimitMax';
import { TableColumnMetadata } from 'Common/Types/Database/TableColumn';

enum DatabaseRequestType {
    Create = 'create',
    Read = 'read',
    Update = 'update',
    Delete = 'delete',
}

class DatabaseService<TBaseModel extends BaseModel> {
    private postgresDatabase!: PostgresDatabase;
    private entityType!: { new (): TBaseModel };
    private model!: TBaseModel;

    public constructor(
        type: { new (): TBaseModel },
        postgresDatabase?: PostgresDatabase
    ) {
        this.entityType = type;
        this.model = new type();

        if (postgresDatabase) {
            this.postgresDatabase = postgresDatabase;
        }
    }

    public getQueryBuilder(modelName: string): SelectQueryBuilder<TBaseModel> {
        return this.getRepository().createQueryBuilder(modelName);
    }

    public getRepository(): Repository<TBaseModel> {
        if (this.postgresDatabase && !this.postgresDatabase.isConnected()) {
            throw new DatabaseNotConnectedException();
        }

        if (!this.postgresDatabase && !PostgresAppInstance.isConnected()) {
            throw new DatabaseNotConnectedException();
        }

        const dataSource: DataSource | null = this.postgresDatabase
            ? this.postgresDatabase.getDataSource()
            : PostgresAppInstance.getDataSource();

        if (dataSource) {
            return dataSource.getRepository<TBaseModel>(this.entityType.name);
        }

        throw new DatabaseNotConnectedException();
    }

    protected isValid(data: TBaseModel): boolean {
        if (!data) {
            throw new BadDataException('Data cannot be null');
        }

        return true;
    }

    protected checkRequiredFields(data: TBaseModel): void {
        // Check required fields.

        for (const requiredField of data.getRequiredColumns().columns) {
            if (typeof (data as any)[requiredField] === Typeof.Boolean) {
                if (
                    !(data as any)[requiredField] &&
                    (data as any)[requiredField] !== false &&
                    !data.isDefaultValueColumn(requiredField)
                ) {
                    throw new BadDataException(`${requiredField} is required`);
                }
            } else if (
                !(data as any)[requiredField] &&
                !data.isDefaultValueColumn(requiredField)
            ) {
                throw new BadDataException(`${requiredField} is required`);
            }
        }
    }

    protected async onBeforeCreate(
        createBy: CreateBy<TBaseModel>
    ): Promise<CreateBy<TBaseModel>> {
        // A place holder method used for overriding.
        return Promise.resolve(createBy as CreateBy<TBaseModel>);
    }

    private async _onBeforeCreate(
        createBy: CreateBy<TBaseModel>
    ): Promise<CreateBy<TBaseModel>> {
        // Private method that runs before create.
        const projectIdColumn: string | null = this.model.getProjectColumn();

        if (projectIdColumn && createBy.props.projectId) {
            (createBy.data as any)[projectIdColumn] = createBy.props.projectId;
        }

        return await this.onBeforeCreate(createBy);
    }

    protected encrypt(data: TBaseModel): TBaseModel {
        const iv: Buffer = Encryption.getIV();
        (data as any)['iv'] = iv;

        for (const key of data.getEncryptedColumns().columns) {
            // If data is an object.
            if (typeof (data as any)[key] === Typeof.Object) {
                const dataObj: JSONObject = (data as any)[key] as JSONObject;

                for (const key in dataObj) {
                    dataObj[key] = Encryption.encrypt(
                        dataObj[key] as string,
                        iv
                    );
                }

                (data as any)[key] = dataObj;
            } else {
                //If its string or other type.
                (data as any)[key] = Encryption.encrypt(
                    (data as any)[key] as string,
                    iv
                );
            }
        }

        return data;
    }

    protected async hash(data: TBaseModel): Promise<TBaseModel> {
        const columns: Columns = data.getHashedColumns();

        for (const key of columns.columns) {
            if (
                data.hasValue(key) &&
                !(data.getValue(key) as HashedString).isValueHashed()
            ) {
                await ((data as any)[key] as HashedString).hashValue(
                    EncryptionSecret
                );
            }
        }

        return data;
    }

    protected decrypt(data: TBaseModel): TBaseModel {
        const iv: Buffer = (data as any)['iv'];

        for (const key of data.getEncryptedColumns().columns) {
            // If data is an object.
            if (typeof data.getValue(key) === Typeof.Object) {
                const dataObj: JSONObject = data.getValue(key) as JSONObject;

                for (const key in dataObj) {
                    dataObj[key] = Encryption.decrypt(
                        dataObj[key] as string,
                        iv
                    );
                }

                data.setValue(key, dataObj);
            } else {
                //If its string or other type.
                data.setValue(key, Encryption.decrypt((data as any)[key], iv));
            }
        }

        return data;
    }

    protected async onBeforeDelete(
        deleteBy: DeleteBy<TBaseModel>
    ): Promise<DeleteBy<TBaseModel>> {
        // A place holder method used for overriding.
        return Promise.resolve(deleteBy);
    }

    protected async onBeforeUpdate(
        updateBy: UpdateBy<TBaseModel>
    ): Promise<UpdateBy<TBaseModel>> {
        // A place holder method used for overriding.
        return Promise.resolve(updateBy);
    }

    protected async onBeforeFind(
        findBy: FindBy<TBaseModel>
    ): Promise<FindBy<TBaseModel>> {
        // A place holder method used for overriding.
        return Promise.resolve(findBy);
    }

    protected async onCreateSuccess(
        createBy: CreateBy<TBaseModel>
    ): Promise<CreateBy<TBaseModel>> {
        // A place holder method used for overriding.
        return Promise.resolve(createBy);
    }

    protected async onCreateError(error: Exception): Promise<Exception> {
        // A place holder method used for overriding.
        return Promise.resolve(error);
    }

    protected async onUpdateSuccess(): Promise<void> {
        // A place holder method used for overriding.
        return Promise.resolve();
    }

    protected async onUpdateError(error: Exception): Promise<Exception> {
        // A place holder method used for overriding.
        return Promise.resolve(error);
    }

    protected async onDeleteSuccess(): Promise<void> {
        // A place holder method used for overriding.
        return Promise.resolve();
    }

    protected async onDeleteError(error: Exception): Promise<Exception> {
        // A place holder method used for overriding.
        return Promise.resolve(error);
    }

    protected async onFindSuccess(
        items: Array<TBaseModel>
    ): Promise<Array<TBaseModel>> {
        // A place holder method used for overriding.
        return Promise.resolve(items);
    }

    protected async onFindError(error: Exception): Promise<Exception> {
        // A place holder method used for overriding.
        return Promise.resolve(error);
    }

    protected async onCountSuccess(
        count: PositiveNumber
    ): Promise<PositiveNumber> {
        // A place holder method used for overriding.
        return Promise.resolve(count);
    }

    protected async onCountError(error: Exception): Promise<Exception> {
        // A place holder method used for overriding.
        return Promise.resolve(error);
    }

    protected async getException(error: Exception): Promise<void> {
        throw error;
    }

    private generateSlug(createBy: CreateBy<TBaseModel>): CreateBy<TBaseModel> {
        if (createBy.data.getSlugifyColumn()) {
            (createBy.data as any)[
                createBy.data.getSaveSlugToColumn() as string
            ] = Slug.getSlug(
                (createBy.data as any)[
                    createBy.data.getSlugifyColumn() as string
                ] as string
            );
        }

        return createBy;
    }

    private serializeCreate(
        data: TBaseModel | QueryDeepPartialEntity<TBaseModel>
    ): TBaseModel | QueryDeepPartialEntity<TBaseModel> {
        const columns: Columns = this.model.getTableColumns();

        for (const columnName of columns.columns) {
            if (this.model.isEntityColumn(columnName)) {
                const tableColumnMetadata: TableColumnMetadata =
                    this.model.getTableColumnMetadata(columnName);

                if (
                    data &&
                    tableColumnMetadata.modelType &&
                    (data as any)[columnName] &&
                    tableColumnMetadata.type === TableColumnType.Entity &&
                    (typeof (data as any)[columnName] === 'string' ||
                        (data as any)[columnName] instanceof ObjectID)
                ) {
                    (data as any)[columnName] =
                        new tableColumnMetadata.modelType();
                    (data as any)[columnName]._id = (data as any)[
                        columnName
                    ].toString();
                }

                if (
                    data &&
                    Array.isArray((data as any)[columnName]) &&
                    (data as any)[columnName].length > 0 &&
                    tableColumnMetadata.modelType &&
                    (data as any)[columnName] &&
                    tableColumnMetadata.type === TableColumnType.EntityArray
                ) {
                    const itemsArray: Array<BaseModel> = [];
                    for (const item of (data as any)[columnName]) {
                        if (
                            typeof item === 'string' ||
                            item instanceof ObjectID
                        ) {
                            const basemodelItem: BaseModel =
                                new tableColumnMetadata.modelType();
                            basemodelItem._id = item.toString();
                            itemsArray.push(basemodelItem);
                        } else {
                            itemsArray.push(item);
                        }
                    }
                    (data as any)[columnName] = itemsArray;
                }
            }
        }

        return data;
    }

    public async create(createBy: CreateBy<TBaseModel>): Promise<TBaseModel> {
        let _createdBy: CreateBy<TBaseModel> = await this._onBeforeCreate(
            createBy
        );

        _createdBy = this.generateSlug(_createdBy);

        let data: TBaseModel = _createdBy.data;

        this.checkRequiredFields(data);

        if (!this.isValid(data)) {
            throw new BadDataException('Data is not valid');
        }

        // Encrypt data
        data = this.encrypt(data);

        // hash data
        data = await this.hash(data);

        data = this.asCreateableByPermissions(createBy);
        createBy.data = data;

        // check uniqueColumns by:
        createBy = await this.checkUniqueColumnBy(createBy);

        // serialize.
        createBy.data = this.serializeCreate(createBy.data) as TBaseModel;

        try {
            createBy.data = await this.getRepository().save(createBy.data);
            await this.onCreateSuccess(createBy);
            return createBy.data;
        } catch (error) {
            await this.onCreateError(error as Exception);
            throw this.getException(error as Exception);
        }
    }

    private async checkUniqueColumnBy(
        createBy: CreateBy<TBaseModel>
    ): Promise<CreateBy<TBaseModel>> {
        let existingItemsWithSameNameCount: number = 0;

        const uniqueColumnsBy: Dictionary<string> = getUniqueColumnsBy(
            createBy.data
        );

        for (const key in uniqueColumnsBy) {
            if (!uniqueColumnsBy[key]) {
                continue;
            }

            existingItemsWithSameNameCount = (
                await this.countBy({
                    query: {
                        [key]: QueryHelper.findWithSameName(
                            (createBy.data as any)[key]
                                ? ((createBy.data as any)[key]! as string)
                                : ''
                        ),
                        [uniqueColumnsBy[key] as any]: (createBy.data as any)[
                            uniqueColumnsBy[key] as any
                        ],
                    },
                    props: {
                        isRoot: true,
                    },
                })
            ).toNumber();

            if (existingItemsWithSameNameCount > 0) {
                throw new BadDataException(
                    `${this.model.singularName} with the same ${key} already exists.`
                );
            }

            existingItemsWithSameNameCount = 0;
        }

        return Promise.resolve(createBy);
    }

    public getPermissions(
        props: DatabaseCommonInteractionProps,
        type: DatabaseRequestType
    ): Array<UserPermission> {
        if (!props.userGlobalAccessPermission) {
            throw new NotAuthorizedException(`Permissions not found.`);
        }

        let isPublicAllowed: boolean = false;
        let modelPermissions: Array<Permission> = [];

        if (type === DatabaseRequestType.Create) {
            isPublicAllowed = this.model.createRecordPermissions.includes(
                Permission.Public
            );
            modelPermissions = this.model.createRecordPermissions;
        }

        if (type === DatabaseRequestType.Update) {
            isPublicAllowed = this.model.updateRecordPermissions.includes(
                Permission.Public
            );
            modelPermissions = this.model.updateRecordPermissions;
        }

        if (type === DatabaseRequestType.Delete) {
            isPublicAllowed = this.model.deleteRecordPermissions.includes(
                Permission.Public
            );
            modelPermissions = this.model.deleteRecordPermissions;
        }

        if (type === DatabaseRequestType.Read) {
            isPublicAllowed = this.model.readRecordPermissions.includes(
                Permission.Public
            );
            modelPermissions = this.model.readRecordPermissions;
        }

        if (!isPublicAllowed && !props.userId) {
            // this means the record is not publicly createable and the user is not logged in.
            throw new NotAuthorizedException(
                `A user should be logged in to ${type} record of type ${this.entityType.name}.`
            );
        }

        if (
            props.userGlobalAccessPermission &&
            !props.userGlobalAccessPermission.globalPermissions.includes(
                Permission.Public
            )
        ) {
            props.userGlobalAccessPermission.globalPermissions.push(
                Permission.Public
            ); // add public permission if not already.
        }

        let userPermissions: Array<UserPermission> = [];

        if (!props.projectId && props.userGlobalAccessPermission) {
            /// take gloabl permissions.
            userPermissions =
                props.userGlobalAccessPermission.globalPermissions.map(
                    (permission: Permission) => {
                        return {
                            permission: permission,
                            labelIds: [],
                        };
                    }
                );
        } else if (props.projectId && props.userProjectAccessPermission) {
            /// take project based permissions because this is a project request.
            userPermissions = props.userProjectAccessPermission.permissions;
        } else {
            throw new NotAuthorizedException(`Permissions not found.`);
        }

        if (
            props.userProjectAccessPermission &&
            !PermissionHelper.doesPermissionsIntersect(
                props.userProjectAccessPermission.permissions.map(
                    (userPermission: UserPermission) => {
                        return userPermission.permission;
                    }
                ) || [],
                modelPermissions
            )
        ) {
            throw new NotAuthorizedException(
                `A user does not have permissions to ${type} record of type ${this.entityType.name}.`
            );
        }

        return userPermissions;
    }

    public asCreateableByPermissions(
        createBy: CreateBy<TBaseModel>
    ): TBaseModel {
        // If system is making this query then let the query run!
        if (createBy.props.isRoot) {
            return createBy.data;
        }

        const userPermissions: Array<UserPermission> = this.getPermissions(
            createBy.props,
            DatabaseRequestType.Create
        );

        const data: TBaseModel = this.keepColumns(
            this.getCreateableColumnsByPermissions(userPermissions || []),
            createBy.data
        );

        return data;
    }

    public asFindByByPermissions(
        findBy: FindBy<TBaseModel>
    ): FindBy<TBaseModel> {
        if (findBy.props.isRoot) {
            return findBy;
        }

        let columns: Columns = new Columns([]);

        const userPermissions: Array<UserPermission> = this.getPermissions(
            findBy.props,
            DatabaseRequestType.Read
        );

        const intersectingPermissions: Array<Permission> =
            PermissionHelper.getIntersectingPermissions(
                userPermissions.map((i: UserPermission) => {
                    return i.permission;
                }),
                this.model.readRecordPermissions
            );

        columns = this.getReadColumnsByPermissions(userPermissions || []);

        const excludedColumns: Array<string> = [
            '_id',
            'createdAt',
            'deletedAt',
            'updatedAt',
        ];

        // Now we need to check all columns.

        for (const key in findBy.query) {
            if (excludedColumns.includes(key)) {
                continue;
            }

            if (!columns.columns.includes(key)) {
                throw new NotAuthorizedException(
                    `A user does not have permissions to query on - ${key}.`
                );
            }
        }

        for (const key in findBy.select) {
            if (excludedColumns.includes(key)) {
                continue;
            }

            if (!columns.columns.includes(key)) {
                throw new NotAuthorizedException(
                    `A user does not have permissions to select on - ${key}.`
                );
            }
        }

        if (this.model.projectColumn && findBy.props.projectId) {
            (findBy.query as any)[this.model.projectColumn] =
                findBy.props.projectId;
        } else if (
            this.model.projectColumn &&
            !findBy.props.projectId &&
            findBy.props.userGlobalAccessPermission
        ) {
            (findBy.query as any)[this.model.projectColumn] = QueryHelper.in(
                findBy.props.userGlobalAccessPermission?.projectIds
            );
        } else if (this.model.projectColumn) {
            throw new NotAuthorizedException(
                'Not enough permissions to read the record'
            );
        }

        if (
            this.model.userColumn &&
            findBy.props.userId &&
            intersectingPermissions.length === 0 &&
            this.model.readRecordPermissions.includes(Permission.CurrentUser)
        ) {
            (findBy.query as any)[this.model.userColumn] = findBy.props.userId;
        }

        if (this.model.isPermissionIf) {
            for (const key in this.model.isPermissionIf) {
                const permission: Permission = key as Permission;

                if (
                    userPermissions
                        .map((i: UserPermission) => {
                            return i.permission;
                        })
                        ?.includes(permission) &&
                    this.model.isPermissionIf[permission]
                ) {
                    const columnName: string = Object.keys(
                        this.model.isPermissionIf[permission] as any
                    )[0] as string;
                    (findBy.query as any)[columnName] = (
                        this.model.isPermissionIf[permission] as any
                    )[columnName];
                }
            }
        }

        return findBy;
    }

    public asUpdateByByPermissions(
        updateBy: UpdateBy<TBaseModel>
    ): UpdateBy<TBaseModel> {
        if (updateBy.props.isRoot) {
            return updateBy;
        }

        const userPermissions: Array<UserPermission> = this.getPermissions(
            updateBy.props,
            DatabaseRequestType.Update
        );

        let updateColumns: Columns = new Columns([]);
        let readColumns: Columns = new Columns([]);

        updateColumns = this.getUpdateColumnsByPermissions(
            userPermissions || []
        );
        readColumns = this.getReadColumnsByPermissions(userPermissions || []);

        // Now we need to check all columns.
        const excludedColumns: Array<string> = [
            '_id',
            'createdAt',
            'deletedAt',
            'updatedAt',
        ];

        for (const key in updateBy.query) {
            if (excludedColumns.includes(key)) {
                continue;
            }

            if (!readColumns.columns.includes(key)) {
                throw new NotAuthorizedException(
                    `A user does not have permissions to query on - ${key}.`
                );
            }
        }

        for (const key in updateBy.data) {
            if (!updateColumns.columns.includes(key)) {
                throw new NotAuthorizedException(
                    `A user does not have permissions to update this record at - ${key}.`
                );
            }
        }

        if (this.model.projectColumn && updateBy.props.projectId) {
            (updateBy.query as any)[this.model.projectColumn] =
                updateBy.props.projectId;
        } else if (
            this.model.projectColumn &&
            !updateBy.props.projectId &&
            updateBy.props.userGlobalAccessPermission
        ) {
            (updateBy.query as any)[this.model.projectColumn] = QueryHelper.in(
                updateBy.props.userGlobalAccessPermission?.projectIds
            );
        } else if (this.model.projectColumn) {
            throw new NotAuthorizedException(
                'Not enough permissions to read the record'
            );
        }

        if (this.model.userColumn && updateBy.props.userId) {
            (updateBy.query as any)[this.model.userColumn] =
                updateBy.props.userId;
        }

        if (this.model.isPermissionIf) {
            for (const key in this.model.isPermissionIf) {
                const permission: Permission = key as Permission;

                if (
                    userPermissions
                        .map((i: UserPermission) => {
                            return i.permission;
                        })
                        ?.includes(permission) &&
                    this.model.isPermissionIf[permission]
                ) {
                    const columnName: string = Object.keys(
                        this.model.isPermissionIf[permission] as any
                    )[0] as string;
                    (updateBy.query as any)[columnName] = (
                        this.model.isPermissionIf[permission] as any
                    )[columnName];
                }
            }
        }

        return updateBy;
    }

    public asDeleteByPermissions(
        deleteBy: DeleteBy<TBaseModel>
    ): DeleteBy<TBaseModel> {
        if (deleteBy.props.isRoot) {
            return deleteBy;
        }

        const userPermissions: Array<UserPermission> = this.getPermissions(
            deleteBy.props,
            DatabaseRequestType.Delete
        );
        const intersectingPermissions: Array<Permission> =
            PermissionHelper.getIntersectingPermissions(
                userPermissions.map((i: UserPermission) => {
                    return i.permission;
                }),
                this.model.deleteRecordPermissions
            );

        if (this.model.projectColumn && deleteBy.props.projectId) {
            (deleteBy.query as any)[this.model.projectColumn] =
                deleteBy.props.projectId;
        }

        if (
            this.model.userColumn &&
            intersectingPermissions.length === 0 &&
            this.model.deleteRecordPermissions.includes(Permission.CurrentUser)
        ) {
            (deleteBy.query as any)[this.model.userColumn] =
                deleteBy.props.userId;
        }

        return deleteBy;
    }

    public getCreateableColumnsByPermissions(
        userPermissions: Array<UserPermission>
    ): Columns {
        const permissions: Array<Permission> = userPermissions.map(
            (item: UserPermission) => {
                return item.permission;
            }
        );

        const accessControl: Dictionary<ColumnAccessControl> =
            this.model.getColumnAccessControlForAllColumns();

        const columns: Array<string> = [];

        for (const key in accessControl) {
            if (
                accessControl[key]?.create &&
                PermissionHelper.doesPermissionsIntersect(
                    permissions,
                    accessControl[key]?.create || []
                )
            ) {
                columns.push(key);
            }
        }

        return new Columns(columns);
    }

    public getReadColumnsByPermissions(
        userPermissions: Array<UserPermission>
    ): Columns {
        const accessControl: Dictionary<ColumnAccessControl> =
            this.model.getColumnAccessControlForAllColumns();

        const columns: Array<string> = [];

        const permissions: Array<Permission> = userPermissions.map(
            (item: UserPermission) => {
                return item.permission;
            }
        );

        for (const key in accessControl) {
            if (
                accessControl[key]?.read &&
                PermissionHelper.doesPermissionsIntersect(
                    permissions,
                    accessControl[key]?.read || []
                )
            ) {
                columns.push(key);
            }
        }

        return new Columns(columns);
    }

    public getUpdateColumnsByPermissions(
        userPermissions: Array<UserPermission>
    ): Columns {
        const accessControl: Dictionary<ColumnAccessControl> =
            this.model.getColumnAccessControlForAllColumns();

        const columns: Array<string> = [];

        const permissions: Array<Permission> = userPermissions.map(
            (item: UserPermission) => {
                return item.permission;
            }
        );

        for (const key in accessControl) {
            if (
                accessControl[key]?.update &&
                PermissionHelper.doesPermissionsIntersect(
                    permissions,
                    accessControl[key]?.update || []
                )
            ) {
                columns.push(key);
            }
        }

        return new Columns(columns);
    }

    private keepColumns(columnsToKeep: Columns, data: TBaseModel): TBaseModel {
        if (!columnsToKeep) {
            return data;
        }

        for (const key of Object.keys(this)) {
            const columns: Columns = data.getTableColumns();

            if (
                !(
                    columnsToKeep &&
                    columnsToKeep.columns.length > 0 &&
                    columnsToKeep.columns.includes(key)
                ) &&
                columns.hasColumn(key)
            ) {
                (this as any)[key] = undefined;
            }
        }

        return data;
    }

    public async countBy({
        query,
        skip,
        limit,
    }: CountBy<TBaseModel>): Promise<PositiveNumber> {
        try {
            if (!skip) {
                skip = new PositiveNumber(0);
            }

            if (!limit) {
                limit = new PositiveNumber(Infinity);
            }

            query = this.serializeQuery(query);

            const count: number = await this.getRepository().count({
                where: query as any,
                skip: skip.toNumber(),
                take: limit.toNumber(),
            });
            let countPositive: PositiveNumber = new PositiveNumber(count);
            countPositive = await this.onCountSuccess(countPositive);
            return countPositive;
        } catch (error) {
            await this.onCountError(error as Exception);
            throw this.getException(error as Exception);
        }
    }

    private serializeQuery(query: Query<TBaseModel>): Query<TBaseModel> {
        for (const key in query) {
            if (
                query[key] &&
                (query[key] as any)._value &&
                Array.isArray((query[key] as any)._value) &&
                (query[key] as any)._value.length > 0
            ) {
                let counter: number = 0;
                for (const item of (query[key] as any)._value) {
                    if (item instanceof ObjectID) {
                        ((query[key] as any)._value as any)[counter] = (
                            (query[key] as any)._value as any
                        )[counter].toString();
                    }
                    counter++;
                }
            } else if (query[key] && query[key] instanceof ObjectID) {
                query[key] = QueryHelper.equalTo(
                    (query[key] as ObjectID).toString() as any
                ) as any;
            } else if (query[key] && query[key] instanceof Search) {
                query[key] = QueryHelper.search(
                    (query[key] as Search).toString() as any
                ) as any;
            } else if (query[key] && Array.isArray(query[key])) {
                query[key] = QueryHelper.in(
                    query[key] as any
                ) as FindOperator<any> as any;
            }
        }

        return query;
    }

    public async deleteOneBy(
        deleteOneBy: DeleteOneBy<TBaseModel>
    ): Promise<number> {
        return await this._deleteBy(deleteOneBy);
    }

    public async deleteBy(deleteBy: DeleteBy<TBaseModel>): Promise<number> {
        return await this._deleteBy(deleteBy);
    }

    private async _deleteBy(deleteBy: DeleteBy<TBaseModel>): Promise<number> {
        try {
            let beforeDeleteBy: DeleteBy<TBaseModel> =
                await this.onBeforeDelete(deleteBy);

            beforeDeleteBy = this.asDeleteByPermissions(beforeDeleteBy);

            await this._updateBy({
                query: deleteBy.query,
                data: {
                    deletedByUserId: deleteBy.props.userId,
                } as any,
                props: {
                    isRoot: true,
                },
            });

            const numberOfDocsAffected: number =
                (await this.getRepository().delete(beforeDeleteBy.query as any))
                    .affected || 0;

            await this.onDeleteSuccess();

            return numberOfDocsAffected;
        } catch (error) {
            await this.onDeleteError(error as Exception);
            throw this.getException(error as Exception);
        }
    }

    public async findBy(
        findBy: FindBy<TBaseModel>
    ): Promise<Array<TBaseModel>> {
        return await this._findBy(findBy);
    }

    private async _findBy(
        findBy: FindBy<TBaseModel>
    ): Promise<Array<TBaseModel>> {
        try {
            if (!findBy.sort || Object.keys(findBy.sort).length === 0) {
                findBy.sort = {
                    createdAt: SortOrder.Descending,
                };
            }

            let onBeforeFind: FindBy<TBaseModel> = await this.onBeforeFind(
                findBy
            );

            onBeforeFind = this.asFindByByPermissions(findBy);

            if (!(onBeforeFind.skip instanceof PositiveNumber)) {
                onBeforeFind.skip = new PositiveNumber(onBeforeFind.skip);
            }

            if (
                !onBeforeFind.select ||
                Object.keys(onBeforeFind.select).length === 0
            ) {
                onBeforeFind.select = {} as any;
            }

            if (!(onBeforeFind.select as any)['_id']) {
                (onBeforeFind.select as any)['_id'] = true;
            }

            if (!(onBeforeFind.select as any)['createdAt']) {
                (onBeforeFind.select as any)['createdAt'] = true;
            }

            if (!(onBeforeFind.limit instanceof PositiveNumber)) {
                onBeforeFind.limit = new PositiveNumber(onBeforeFind.limit);
            }

            onBeforeFind.query = this.serializeQuery(onBeforeFind.query);

            const items: Array<TBaseModel> = await this.getRepository().find({
                skip: onBeforeFind.skip.toNumber(),
                take: onBeforeFind.limit.toNumber(),
                where: onBeforeFind.query as any,
                order: onBeforeFind.sort as any,
                relations: onBeforeFind.populate as any,
                select: onBeforeFind.select as any,
            });

            const decryptedItems: Array<TBaseModel> = [];

            for (const item of items) {
                decryptedItems.push(this.decrypt(item));
            }

            await this.onFindSuccess(decryptedItems);

            return decryptedItems;
        } catch (error) {
            await this.onFindError(error as Exception);
            throw this.getException(error as Exception);
        }
    }

    public async findOneBy(
        findOneBy: FindOneBy<TBaseModel>
    ): Promise<TBaseModel | null> {
        const findBy: FindBy<TBaseModel> = findOneBy as FindBy<TBaseModel>;
        findBy.limit = new PositiveNumber(1);
        findBy.skip = new PositiveNumber(0);

        const documents: Array<TBaseModel> = await this._findBy(findBy);

        if (documents && documents[0]) {
            return documents[0];
        }
        return null;
    }

    public async findOneById(
        findOneById: FindOneByID<TBaseModel>
    ): Promise<TBaseModel | null> {
        return await this.findOneBy({
            query: {
                _id: findOneById.id.toString() as any,
            },
            select: findOneById.select || {},
            populate: findOneById.populate || {},
            props: findOneById.props,
        });
    }

    private async _updateBy(updateBy: UpdateBy<TBaseModel>): Promise<number> {
        try {
            let beforeUpdateBy: UpdateBy<TBaseModel> =
                await this.onBeforeUpdate(updateBy);

            beforeUpdateBy = this.asUpdateByByPermissions(beforeUpdateBy);

            const query: Query<TBaseModel> = this.serializeQuery(
                beforeUpdateBy.query
            );
            const data: QueryDeepPartialEntity<TBaseModel> =
                this.serializeCreate(
                    beforeUpdateBy.data
                ) as QueryDeepPartialEntity<TBaseModel>;

            const items: Array<TBaseModel> = await this._findBy({
                query,
                skip: 0,
                limit: LIMIT_MAX,
                populate: {},
                select: {},
                props: beforeUpdateBy.props,
            });

            for (let item of items) {
                item = {
                    ...item,
                    ...data,
                };

                await this.getRepository().save(item);
            }

            // Cant Update relations.
            // https://github.com/typeorm/typeorm/issues/2821

            // const numberOfDocsAffected: number =
            //     (
            //         await this.getRepository().update(
            //             query as any,
            //             data
            //         )
            //     ).affected || 0;

            await this.onUpdateSuccess();

            return items.length;
        } catch (error) {
            await this.onUpdateError(error as Exception);
            throw this.getException(error as Exception);
        }
    }

    public async updateOneBy(
        updateOneBy: UpdateOneBy<TBaseModel>
    ): Promise<number> {
        return await this._updateBy(updateOneBy);
    }

    public async updateBy(updateBy: UpdateBy<TBaseModel>): Promise<number> {
        return await this._updateBy(updateBy);
    }

    public async updateOneById(
        updateById: UpdateByID<TBaseModel>
    ): Promise<void> {
        await this.updateOneBy({
            query: {
                _id: updateById.id.toString() as any,
            },
            data: updateById.data,
            props: updateById.props,
        });
    }

    public async updateOneByIdAndFetch(
        updateById: UpdateByID<TBaseModel>
    ): Promise<TBaseModel | null> {
        await this.updateOneById(updateById);
        return this.findOneById({
            id: updateById.id,
            props: updateById.props,
        });
    }

    public async searchBy({
        skip,
        limit,
        select,
        populate,
        props,
    }: SearchBy<TBaseModel>): Promise<SearchResult<TBaseModel>> {
        const query: Query<TBaseModel> = {};

        // query[column] = RegExp(`^${text}`, 'i');

        const [items, count]: [Array<TBaseModel>, PositiveNumber] =
            await Promise.all([
                this.findBy({
                    query,
                    skip,
                    limit,
                    select,
                    populate,
                    props: props,
                }),
                this.countBy({
                    query,
                    skip: new PositiveNumber(0),
                    limit: new PositiveNumber(Infinity),
                    props: props,
                }),
            ]);

        return { items, count };
    }
}

export default DatabaseService;
