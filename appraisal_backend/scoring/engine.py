def teaching(classes_taught, assigned_classes):
    if total_classes == 0:
        grade = 0
    else:
        grade = (classes_taught / assigned_classes) * 100
    
    if grade >= 80:
        return 'Good'
    elif grade >= 70:
        return 'Satisfactory'
    else:
        return 'Not Satisfactory'

def Activity_Score(No_of_Activities):

    if No_of_Activities >= 3:
        return 'Good'
    elif 1 > No_of_Activities < 2:
        return 'Satisfactory'
    else:
        return 'Not Satisfactory'


#All done for Table 1

#Now for Table 2

def research_scoring(Research_papers, International_publisher, National_publisher, Chapter_in_Edited_Book, Editor_of_Book_by_International_Publisher, Editor_of_Book_by_National_Publisher, Translation_in_Chapter_or_Research_Paper, Translation_in_Book):   
    score = 0        
    #if Published Research Papers in Peer-Reviewed or UGC listed Journals score = +8
    if Research_papers == 'Yes':
        score += 8
    if International_publisher == 'Yes':
        score += 12
    if National_publisher == 'Yes':
        score += 10
    if Chapter_in_Edited_Book == 'Yes':
        score += 5
    if Editor_of_Book_by_International_Publisher == 'Yes':
        score += 10
    if Editor_of_Book_by_National_Publisher == 'Yes':
        score += 8
    if Translation_in_Chapter_or_Research_Paper == 'Yes':
        score += 3
    if Translation_in_Book == 'Yes':
        score += 8

    return score

def research_guidance(PhD_degree_awarded, PhD_thesis_submitted, MPhil_or_PG_dissertation_awarded, research_consultancy, research_project_completed, research_project_ongoing, amount):
    score = 0
    if PhD_degree_awarded== 'Yes':
        score += 10
    if PhD_thesis_submitted == 'Yes':
        score += 5
    if MPhil_or_PG_dissertation_awarded == 'Yes':
        score += 2
    
    if research_consultancy == 'Yes':
        score += 3
    
    if research_project_completed == 'Yes':
        if amount > 1000000:
            score += 10
        else:
            score += 5
    if research_project_ongoing == 'Yes':
        if amount > 1000000:
            score += 5
        else:
            score += 2

def patents( patents_filed, policy_document, Awards_or_fellowship, international_level, national_level, state_level):
    score = 0
    if patents_filed == 'Yes':
        if international_level == 'Yes':
            score += 10
        if national_level == 'Yes':
            score += 7

    if policy_document == 'Yes':
        if national_level == 'Yes':
            score += 7
        if international_level == 'Yes':
            score += 10
        if state_level == 'Yes':
            score += 4
    
    if Awards_or_fellowship == 'Yes':
        if international_level == 'Yes':
            score += 7
        if national_level == 'Yes':
            score += 5

    return score

def presented_papers( presented, international_level_abroad, national_level, state_level, international_level_india):
    score = 0
    if presented == 'Yes':
        if international_level_abroad == 'Yes':
            score += 7
        if national_level == 'Yes':
            score += 3
        if state_level == 'Yes':
            score += 2
        if international_level_india == 'Yes':
            score += 5
    return score

def pedagogy_creation( developed_innovative_pedagogy, designed_new_curriculum, MOOCs, complete_course_in_4_quadrants, content_writer, course_coordinator, per_lecture_moocs, e_content, editor_of_e_content, contributor, content_per_module):
    score = 0
    if developed_innovative_pedagogy == 'Yes':
        score += 5
    if designed_new_curriculum == 'Yes':
        score += 2
    if MOOCs == 'Yes':
        if complete_course_in_4_quadrants == 'Yes':
            score += 20
        if content_writer == 'Yes':
            score += 2
        if course_coordinator == 'Yes':
            score += 8
        if per_lecture_moocs == 'Yes':
            score += 5
    if e_content == 'Yes':
        if complete_course_in_4_quadrants == 'Yes':
            score += 12
        if editor_of_e_content == 'Yes':
            score += 10
        if contributor == 'Yes':
            score += 2
        if content_per_module == 'Yes':
            score += 5
    return score
