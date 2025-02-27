import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from 'Common/Models/BaseModel';
import User from './User';
import ColumnType from 'Common/Types/Database/ColumnType';
import PositiveNumber from 'Common/Types/PositiveNumber';
import ObjectID from 'Common/Types/ObjectID';
import ColumnLength from 'Common/Types/Database/ColumnLength';
import TableColumn from 'Common/Types/Database/TableColumn';
import CrudApiEndpoint from 'Common/Types/Database/CrudApiEndpoint';
import Route from 'Common/Types/API/Route';
import TableColumnType from 'Common/Types/Database/TableColumnType';
import SlugifyColumn from 'Common/Types/Database/SlugifyColumn';
import TableAccessControl from 'Common/Types/Database/AccessControl/TableAccessControl';
import Permission from 'Common/Types/Permission';
import ColumnAccessControl from 'Common/Types/Database/AccessControl/ColumnAccessControl';
import ProjectColumn from 'Common/Types/Database/ProjectColumn';
import EntityName from 'Common/Types/Database/EntityName';

@TableAccessControl({
    create: [Permission.User],
    read: [Permission.ProjectMember],
    delete: [Permission.ProjectOwner, Permission.CanDeleteProject],
    update: [
        Permission.ProjectOwner,
        Permission.CanManageProjectBilling,
        Permission.CanUpdateProject,
    ],
})
@EntityName('Project', 'Projects')
@CrudApiEndpoint(new Route('/project'))
@SlugifyColumn('name', 'slug')
@Entity({
    name: 'Project',
})
@ProjectColumn('_id')
export default class Model extends BaseModel {
    @ColumnAccessControl({
        create: [Permission.User],
        read: [Permission.ProjectMember],
        update: [
            Permission.ProjectOwner,
            Permission.CanManageProjectBilling,
            Permission.CanUpdateProject,
        ],
    })
    @TableColumn({ required: true, type: TableColumnType.ShortText })
    @Column({
        nullable: false,
        type: ColumnType.ShortText,
        length: ColumnLength.ShortText,
    })
    public name?: string = undefined;

    @Index()
    @ColumnAccessControl({
        create: [Permission.User],
        read: [Permission.ProjectMember],
        update: [],
    })
    @TableColumn({ required: true, unique: true, type: TableColumnType.Slug })
    @Column({
        nullable: false,
        type: ColumnType.Slug,
        length: ColumnLength.Slug,
        unique: true,
    })
    public slug?: string = undefined;

    @ColumnAccessControl({
        create: [Permission.User],
        read: [Permission.ProjectMember],
        update: [],
    })
    @TableColumn({ type: TableColumnType.ShortText })
    @Column({
        type: ColumnType.ShortText,
        length: ColumnLength.ShortText,
        nullable: true,
        unique: false,
    })
    public paymentProviderPlanId?: string = undefined;

    @ColumnAccessControl({
        create: [Permission.User],
        read: [Permission.ProjectMember],
        update: [],
    })
    @TableColumn({ type: TableColumnType.ShortText })
    @Column({
        type: ColumnType.ShortText,
        length: ColumnLength.ShortText,
        nullable: true,
        unique: false,
    })
    public paymentProviderSubscriptionId?: string = undefined;

    @ColumnAccessControl({
        create: [],
        read: [Permission.ProjectMember],
        update: [],
    })
    @TableColumn({
        type: TableColumnType.SmallPositiveNumber,
        isDefaultValueColumn: true,
    })
    @Column({
        type: ColumnType.SmallPositiveNumber,
        nullable: false,
        unique: false,
        default: 1,
    })
    public numberOfLicensesIssued?: PositiveNumber = undefined;

    @ColumnAccessControl({
        create: [Permission.User],
        read: [Permission.ProjectMember],
        update: [],
    })
    @TableColumn({
        manyToOneRelationColumn: 'createdByUserId',
        type: TableColumnType.Entity,
        modelType: User,
    })
    @ManyToOne(
        (_type: string) => {
            return User;
        },
        {
            eager: false,
            nullable: true,
            onDelete: 'CASCADE',
            orphanedRowAction: 'nullify',
        }
    )
    @JoinColumn({ name: 'createdByUserId' })
    public createdByUser?: User = undefined;

    @ColumnAccessControl({
        create: [],
        read: [Permission.ProjectMember],
        update: [],
    })
    @TableColumn({ type: TableColumnType.ObjectID })
    @Column({
        type: ColumnType.ObjectID,
        nullable: true,
        transformer: ObjectID.getDatabaseTransformer(),
    })
    public createdByUserId?: ObjectID = undefined;

    @ColumnAccessControl({
        create: [],
        read: [],
        update: [],
    })
    @TableColumn({
        manyToOneRelationColumn: 'deletedByUserId',
        type: TableColumnType.ObjectID,
    })
    @ManyToOne(
        (_type: string) => {
            return User;
        },
        {
            cascade: false,
            eager: false,
            nullable: true,
            onDelete: 'CASCADE',
            orphanedRowAction: 'nullify',
        }
    )
    @JoinColumn({ name: 'deletedByUserId' })
    public deletedByUser?: User = undefined;

    @ColumnAccessControl({
        create: [],
        read: [Permission.ProjectMember],
        update: [],
    })
    @TableColumn({ type: TableColumnType.ObjectID })
    @Column({
        type: ColumnType.ObjectID,
        nullable: true,
        transformer: ObjectID.getDatabaseTransformer(),
    })
    public deletedByUserId?: ObjectID = undefined;

    @ColumnAccessControl({
        create: [],
        read: [Permission.ProjectMember],
        update: [
            Permission.ProjectOwner,
            Permission.CanManageProjectBilling,
            Permission.CanUpdateProject,
        ],
    })
    @TableColumn({
        required: true,
        type: TableColumnType.Boolean,
        isDefaultValueColumn: true,
    })
    @Column({
        type: ColumnType.Boolean,
        nullable: false,
        unique: false,
        default: false,
    })
    public alertsEnabled?: boolean = undefined;

    @ColumnAccessControl({
        create: [],
        read: [Permission.ProjectOwner, Permission.CanManageProjectBilling],
        update: [],
    })
    @TableColumn({
        required: true,
        type: TableColumnType.SmallPositiveNumber,
        isDefaultValueColumn: true,
    })
    @Column({
        type: ColumnType.SmallPositiveNumber,
        nullable: false,
        unique: false,
        default: 0,
    })
    public alertAccountBalance?: number = undefined;

    @ColumnAccessControl({
        create: [],
        read: [],
        update: [],
    })
    @TableColumn({
        required: true,
        type: TableColumnType.Boolean,
        isDefaultValueColumn: true,
    })
    @Column({
        type: ColumnType.Boolean,
        nullable: false,
        unique: false,
        default: false,
    })
    public isBlocked?: boolean = undefined;

    @ColumnAccessControl({
        create: [],
        read: [],
        update: [],
    })
    @TableColumn({ type: TableColumnType.SmallPositiveNumber })
    @Column({
        type: ColumnType.SmallPositiveNumber,
        nullable: true,
        unique: false,
    })
    public unpaidSubscriptionNotificationCount?: PositiveNumber = undefined;

    @ColumnAccessControl({
        create: [],
        read: [],
        update: [],
    })
    @TableColumn({ type: TableColumnType.Date })
    @Column({
        type: ColumnType.Date,
        nullable: true,
        unique: false,
    })
    public paymentFailedDate?: Date = undefined;

    @ColumnAccessControl({
        create: [],
        read: [],
        update: [],
    })
    @TableColumn({ type: TableColumnType.Date })
    @Column({
        type: ColumnType.Date,
        nullable: true,
        unique: false,
    })
    public paymentSuccessDate?: Date = undefined;
}
