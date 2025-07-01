export interface Stack {
    Id: number;
    Name: string;
    EndpointId: string;
    EntryPoint: string;
    Status: number;
    ProjectPath: string;
    CreationDate: number;
    CreatedBy: string;
    UpdateDate: number;
    UpdatedBy: string;
    AdditionalFiles: string;
    AutoUpdate: string;
    Option: string;
    GitConfig: string;
    FromAppTemplate: boolean;
    Namespace: string;
    CreatedByUserId: string;
    Webhook: string;
    SupportRelativePath: boolean;
    FilesystemPath: string;
    StackFileVersion: number;
    PreviousDeploymentInfo: {
        Version: number;
        FileVersion: number;
        ConfigHash: string;
    };
    IsDetachedFromGit: boolean;
}